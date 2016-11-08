(function() {
    'use strict';




    const Cachd     = require('cachd');




    class RateLimitSingleton {

        constructor() {

            // holds the actual buckets
            this.buckets = new Map();


            // the rate limits are role based
            // so lets cache the configs of them
            this.roleCache = new Cachd({
                  ttl: 3600000 // 1h
                , maxLength: 10000
                , removalStrategy: 'leastUsed'
            });
        }




        /**
         * pay rate limit credits
         */
        pay(service, permission, amount) {
            if (this.buckets.has()) {

            }
        }





        /**
         * get the limit for the tokens
         */
        getLimit(service, permission) {

        }





        /**
         * get the current credits
         */
        getCredits(service, permission) {

        }







        proxy(service) {
            this.services.set(services.getName(), service);
            return this;
        }
    }





    module.exports = new RateLimitSingleton();
})();
