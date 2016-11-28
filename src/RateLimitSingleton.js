(function() {
    'use strict';




    const Cachd             = require('cachd');
    const log               = require('ee-log');
    const LeakyBucket       = require('leaky-bucket');
    const RelationalRequest = require('./RelationalRequest');






    class RateLimitSingleton {

        constructor() {

            // holds the actual buckets
            this.buckets = new Map();


            // the rate limits are per token
            this.tokenCache = new Cachd({
                  ttl: 3600000 // 1h
                , maxLength: 10000
                , removalStrategy: 'leastUsed'
            });

            // tracks which buckets got updated
            this.updatedBuckets = new Set();


            // make sure updated valuea are stored in the db
            //this.interval = setInterval(this.storeValues.bind(this), 1000);
        }







        storeValues() {
            for (const limit of this.updatedBuckets) {
                new RelationalRequest({
                      action: 'updateOne'
                    , service: 'permissions'
                    , resource: 'rateLimit'
                    , resourceId: limit.token
                    , data: {

                    }
                }).send(this).then().catch();
            }

            this.updatedBuckets.clear();
        }






        /**
         * pay rate limit credits
         */
        pay(service, permission, amount) {
            const limit = this.manageLimits(service, permission);

            if (limit) {
                this.updatedBuckets.add(limit);
                return limit.bucket.pay(amount);
            } else {
                return true;
            }
        }






        /**
         * get the current credits
         */
        getCredits(permission) {
            const limit = this.manageLimits(null, permission);

            if (limit) {
                return limit.bucket.getInfo().left;
            } else {
                return null;
            }
        }






        /**
         * get the current credits
         */
        getInfo(permission) {
            const limit = this.manageLimits(null, permission);

            if (limit) {
                return limit.bucket.getInfo();
            } else {
                return null;
            }
        }







        manageLimits(service, permission) {
            const tokens = permission.getRateLimits().map((limit) => {
                if (!this.tokenCache.has(limit.token)) {
                    const bucket = new LeakyBucket(limit.credits);

                    if (limit.remaining) bucket.left = limit.remaining;
                    if (limit.updated) bucket.last = new Date(limit.updated).getTime();

                    this.tokenCache.set(limit.token, {
                          bucket    : bucket
                        , credits   : limit.credits
                        , service   : service
                        , interval  : limit.interval
                    });
                } else {
                    this.tokenCache.get(limit.token).service = service;
                }

                return limit.token;
            });


            return this.getCurrentLimit(tokens);
        }






        getCurrentLimit(tokens) {
            let limit;

            tokens.forEach((token) => {
                const currentLimit = this.tokenCache.get(token);
                if (!limit || currentLimit.credits < limit.credits) limit = currentLimit;
            });

            return limit;
        }
    }





    module.exports = new RateLimitSingleton();
})();
