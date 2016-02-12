var _ = require('lodash')
    , request = require('request')
    , qs = require('qs')
    , Q = require('q')
    , BASE_URL = 'http://tidesandcurrents.noaa.gov/api/datagetter'
;
module.exports = {
    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {
        var stations = step.input('stations').toArray()
            , self = this
            , baseQuery = {
                date: 'latest'
                , product: 'wind'
                , units: 'english'
                , time_zone: 'gmt'
                , format: 'json'
            }
        ;
        Q.allSettled(_.map(stations, function(station) {
            var query = qs.stringify(_.extend(baseQuery, { station: station }));
            return self.query(query);
        }))
            .then(function(allResponses) {
                self.complete(_.compact(_.map(allResponses, function(resp) {
                    var data;
                    if(resp.state !== 'fulfilled') {
                        self.log('Invalid response from server', { response: resp });
                        return null;
                    }
                    try {
                        data = JSON.parse(resp.value.body);
                    } catch(e) {
                        self.log('Invalid JSON data from server', { data: resp.value.body });
                        return null;
                    }
                    if(data.error) {
                        self.log('Error response', { error: data.error });
                        return null;
                    }
                    return ({
                        time: _.get(data, 'data[0].t', null)
                        , speed: _.get(data, 'data[0].s', null)
                        , direction: _.get(data, 'data[0].dr', null)
                        , gust: _.get(data, 'data[0].g', null)
                        , station_id: _.get(data, 'metadata.id', null)
                        , station_name: _.get(data, 'metadata.name', null)
                    });
                })));
            })
            .fail(function(err) {
                self.fail(err);
            })
        ;
    }
    , query: function(query) {
        var url = BASE_URL + '?' + query
            , deferred = Q.defer()
        ;
        request.get(url, function(err, resp) {
            if(err) deferred.reject(err);
            else deferred.resolve(resp); 
        });
        return deferred.promise;
    }

};
