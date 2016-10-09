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






        enableAction(actionName) {
            this.actionRegistry.add(actionName);
        }







        load() {
            return Promise.resolve();
        }





        dispatchRequest(request, response, permissions) {
            response.resourceName = this.name;
            response.actionName = request.action;

            if (this.actionRegistry.has(request.action)) {
                return this[request.action](request, response, permissions);
            } else return response.invalidAction(`The action ${request.action} is not registered on the ${this.name} resource!`);
        }




        receiveRequest(request, response, permissions) {
            return this.dispatchRequest(request, response, permissions);
        }







        sendRequest(request, response) {

            // attach sender resource
            request.requestingResource = this.name;

            return this.executeHook('request', request, response);
        }


        set onRequest(listener) {
            this.storeHook('request', listener);
        }
    };
})();
