(function() {
    'use strict';



    // the singlton manages the tokens across
    // all loaded services in the process so
    // that the rate limiting takes far less
    // resources and is also way more accurate
    const singleton = require('./RateLimitSingleton');





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





        /**
         * get the limit for the tokens
         */
        getLimit(permission) {
             singleton.getLimit(this.service, permission);
        }





        /**
         * get the current credits
         */
        getCredits(permission) {
             singleton.getCredits(this.service, permission);
        }
    };
})();
