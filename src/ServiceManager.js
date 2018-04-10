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





        end() {
            return Promise.all(Array.from(this.services.values()).map(service => service.end()));
        }





        load() {
            this.loading = true;
            return Promise.all(Array.from(this.services.keys()).map((serviceName) => {
                return new Promise((resolve, reject) => {
                    let loaderTimeout = setTimeout(() => {
                        loaderTimeout = null;
                        reject(new Error(`The ${serviceName} service failed to load. Timeout triggered!`));
                    }, 30000);

                    // load now
                    return this.services.get(serviceName).load().then(() => {
                        if (loaderTimeout) {
                            clearTimeout(loaderTimeout);
                            resolve();
                        }
                    }).catch((err) => {
                        if (loaderTimeout) {
                            clearTimeout(loaderTimeout);
                            reject(err);
                        }
                    });
                });
            })).then(() => {
                this.loaded = true;
                this.loading = false;
                return Promise.resolve();
            });
        }





        /**
        * is called as soon the application is on-line
        * and additional services may start listening
        * with their own servers
        */
        applicationIsOnline() {
            for (const service of this.services.values()) {
                service.applicationIsOnline();
            }
        }





        registerService(service) {
            if (this.services.has(service.getName())) throw new Error(`Cannot register service ${service.getName()}. It was already registered before!`);


            // check if we have to load the service
            if (this.loading && this.loaded) {
                service.load().then(() => {

                    // manage requests
                    service.onRequest = this.handleRequest.bind(this);

                    // register
                    this.services.set(service.getName(), service);
                }).catch(err);
            } else {
                // manage requests
                service.onRequest = this.handleRequest.bind(this);

                // register
                this.services.set(service.getName(), service);
            }
        }






        /**
        * returns an array containing all services
        */
        getServices() {
            return Array.from(this.services.values());
        }








        removeService(service) {
            const name = typeof service === 'object' ? service.getName() : service;

            if (this.services.has(name)) {
                const service = this.services.get(name);

                // remove hooks
                service.clearHooks();

                // remove
                this.services.delete(name);

                return true;
            } else return false;
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
