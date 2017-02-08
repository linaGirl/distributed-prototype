(function() {
    'use strict';


    module.exports = class RequestMiddleware {



        load() {
            return Promise.resolve();
        }





        hookOutgoingRequests() {
            return false;
        }





        hookIncomingRequests() {
            return false;
        }
    }
})();
