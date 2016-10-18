(function() {
    'use strict';


    const Service = require('./Service');
    const log = require('ee-log');




    module.exports = class TestService extends Service {


        constructor(options) {

            // make sure the options exist and the service has a proper name
            options = options || {};


            // default name
            if (!options.name) options.name = 'test-service';


            // super will load the controllers
            super(options);
        }






        request(request) {
            return request.send(this);
        }
    };
})();
