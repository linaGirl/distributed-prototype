(function() {
    'use strict';


    const Service = require('./Service');
    const log = require('ee-log');
    const ResourceController = require('./ResourceController');





    module.exports = class TestService extends Service {


        constructor(options) {

            // make sure the options exist and the service has a proper name
            options = options || {};


            // default name
            if (!options.name) options.name = 'test-service';


            // super will load the controllers
            super(options);
        }






        intercept(resourceName, action, listener) {

            // we're ok ;)
            this.loaded = true;


            const resource = new ResourceController(resourceName);
            resource[action] = listener;
            resource.enableAction(action);
            this.registerResource(resourceName, resource);
        }




        cancelIntercept(resourceName) {
            if (this.resources.has(resourceName)) this.resources.delete(resourceName);
        }






        request(request) {
            return request.send(this);
        }
    };
})();
