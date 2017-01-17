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
            let resource;


            // we're ok ;)
            this.loaded = true;


            // check if the resource exists already
            if (this.resources.has(resourceName)) resource = this.resources.get(resourceName);
            else {
                resource = new ResourceController(resourceName);
                this.registerResource(resource);
            }
        
        
            resource[action] = listener;
            resource.enableAction(action);
        }




        cancelIntercept(resourceName) {
            if (this.resources.has(resourceName)) this.resources.delete(resourceName);
        }






        request(request) {
            return request.send(this);
        }
    };
})();
