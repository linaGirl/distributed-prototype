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






        registerService(service) {
            if (this.services.has(service.getName())) throw new Error(`Cannot register service ${service.getName()}. It was already registered before!`);

            // manage requests
            service.onRequest = this.handleRequest.bind(this);


            // register
            if (service.isLoaded()) this.services.set(service.getName(), service);
            else {

                // wait until the service is ready
                service.load().then(() => {
                    this.services.set(service.getName(), service);
                }).catch((err) => {
                    log.warn(`Failed to load service ${service.getName()}!`);
                    log(err);
                });
            }
        }





        handleRequest(request, response) {
            if (!type.object(request) || !type.function(request.hasService)) throw new Error(`Expected a request, got something else!`);
            else if (this.services.has(request.getService())) {

                // nice, service is avilable
                this.services.get(request.getService()).receiveRequest(request, response);
            } else response.serviceUnavailable('service_not_registered', `The service ${request.getService()} was not registered and is not available!`);
        }
    }
})();
