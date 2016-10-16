(function() {
    'use strict';



    const Hook = require('./Hook');
    const log = require('ee-log');




    module.exports = class ResourceController extends Hook {


        constructor(name) {
            super();

            this.name = name;
            this.actionRegistry = new Set();
        }



        setService(service) {
            this.serviceName = service;
        }


        enableAction(actionName) {
            this.actionRegistry.add(actionName);
        }


        getName() {
            return this.name;
        }

        getServiceName() {
            return this.serviceName;
        }







        /**
         * load hook
         */
        load() {
            return Promise.resolve();
        }









        /**
         * incoming request routing
         */
        dispatchRequest(request, response, permissions) {
            response.resourceName = this.name;
            response.actionName = request.action;

            if (this.actionRegistry.has(request.action)) {
                return this[request.action](request, response, permissions);
            } else return response.invalidAction(`The action ${request.action} is not registered on the ${this.name} resource!`);
        }







        /**
         * incoming reauests
         */
        receiveRequest(request, response, permissions) {
            return Promise.resolve().then(() => {
                const value = this.dispatchRequest(request, response, permissions);

                // check if we got a promise
                if (value && value.then && value.catch) return value;
                else return Promise.resolve();
            }).catch((err) => {

                // handle the crap
                response.error('controller_error', `The action ${request.action} controller ${his.name} failed!`, err);

                return Promise.resolve();
            });
        }






        /**
         * outgoing requests
         */
        sendRequest(request, response) {

            // attach sender resource
            request.requestingResource = this.name;

            return this.executeHook('request', request, response);
        }




        /**
         * hook registration for the service
         */
        set onRequest(listener) {
            this.storeHook('request', listener);
        }
    };
})();
