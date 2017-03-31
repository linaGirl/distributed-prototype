(function() {
    'use strict';



    const Hook = require('./Hook');
    const log = require('ee-log');




    module.exports = class ResourceController extends Hook {


        constructor(name) {
            super();

            this.name = name;
            this.actionRegistry = new Set();

            if (typeof this.enableActions === 'function') this.enableActions();
        }



        setServiceName(serviceName) {
            this.serviceName = serviceName;
        }

        getServiceName() {
            return this.serviceName;
        }




        getName() {
            return this.name;
        }



        enableAction(actionName) {
            this.actionRegistry.add(actionName);
        }






        /**
         * load hook
         */
        load() {
            return Promise.resolve();
        }



        /**
        * end hook
        */
        end() {
            return Promise.resolve();
        }





        /**
         * incoming request routing
         */
        dispatchRequest(request, response, permissions) {
            response.resourceName = this.name;
            response.actionName = request.action;

            if (this.actionRegistry.has(request.action)) {
                if (typeof this[request.action] === 'function') return this[request.action](request, response, permissions);
                else return response.invalidAction(`The action ${request.action} was not implemented on the ${this.getName()} resource!`);
            } else return response.invalidAction(`The action ${request.action} is not registered on the ${this.getName()} resource!`);
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
                log(err);

                // handle the crap
                response.error('controller_error', `The action ${request.action} on the ${this.getName()} controller failed!`, err);

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
