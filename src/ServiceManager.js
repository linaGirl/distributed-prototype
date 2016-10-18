(function() {
    'use strict';


    const Hook = require('./Hook');
    const type = require('ee-types');
    const log = require('ee-log');





    module.exports = class ServiceManager extends Hook {


        constructor(options) {
            super();

            this.services = new Map();
        }





        load() {
            return Promise.all(Array.from(this.services.keys()).map((serviceName) => {
                return this.services.get(serviceName).load();
            })).then(() => Promise.resolve());
        }





        registerService(service) {
            if (this.services.has(service.getName())) throw new Error(`Cannot register service ${service.getName()}. It was already registered before!`);

            // manage requests
            service.onRequest = this.handleRequest.bind(this);

            // register
            this.services.set(service.getName(), service);
        }





        getResourceNames() {
            return Array.from(this.services.keys()).map((serviceName) => {
                return {
                      resources     : this.services.get(serviceName).getResourceNames()
                    , serviceName   : serviceName
                };
            });
        }





        handleRequest(request, response) {
            if (!type.object(request) || !type.function(request.hasService)) throw new Error(`Expected a request, got something else!`);
            else if (this.services.has(request.getService())) {
                const service =  this.services.get(request.getService());

                // check if its loaded
                if (!service.isLoaded()) response.serviceUnavailable('service_not_loaded', `The service ${request.getService()} was registerd but was not yet loaded!`);
                else {

                    // nice, service is avilable
                    this.services.get(request.getService()).receiveRequest(request, response);
                }
            }
            else if (this.hasHooks('request')) this.executeHook('request', request, response);
            else response.serviceUnavailable('service_not_registered', `The service ${request.getService()} was not registered and is not available!`);
        }




        set onRequest(listener) {
            this.storeHook('request', listener);
        }
    }
})();
