(function() {
    'use strict';



    const Hook = require('./Hook');
    const log = require('ee-log');




    module.exports = class WebsiteController extends Hook {


        constructor(name) {
            super();

            this.name = name;
        }




        

        setServiceName(serviceName) {
            this.serviceName = serviceName;
        }

        getServiceName() {
            return this.serviceName;
        }





        /**
         * load hook
         */
        load(app) {

            // the express app
            this.app = app;


            if (typeof this.loadRoutes === 'function') return this.loadRoutes(app);
            else return Promise.resolve();
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






        setService(service) {
            this.serviceName = service;
        }


        setPermissionManager(permissions) {
            this.permissions = permissions;
        }


        getName() {
            return this.name;
        }

        getServiceName() {
            return this.serviceName;
        }
    };
})();
