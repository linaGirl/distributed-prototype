(function() {
    'use strict';



    // the singlton manages the tokens across
    // all loaded services in the process so
    // that the rate limiting takes far less
    // resources and is also way more accurate
    const singleton = require('./RateLimitSingleton');
    const log       = require('ee-log');





    module.exports = class RateLimitManager {


        constructor(service) {


            // the singleton
            this.service = service;
        }





        /**
         * pay rate limit credits
         */
        pay(permission, amount) {
            singleton.pay(this.service, permission, amount);
        }




        getInfo(permission) {
            return singleton.getInfo(permission);
        }



        /**
         * get the current credits
         */
        getCredits(permission) {
             return singleton.getCredits(permission);
        }
    };
})();
