(function() {
    'use strict';

    const RelationalRequest         = require('./RelationalRequest');
    const FilterBuilder             = require('./FilterBuilder');
    const PermissionInstance        = require('./PermissionInstance');
    const PermissionLearner         = require('./PermissionLearner');
    const PermissionTokenManager    = require('./PermissionTokenManager');
    const RateLimitManager          = require('./RateLimitManager');


    const Cachd     = require('cachd');
    const type      = require('ee-types');
    const log       = require('ee-log');
    const crypto    = require('crypto');



    const learningSession = process.env.learnPermissions || process.argv.some(a => a === '--learn-permissions');


    module.exports = class PermissionManager {


        constructor(service) {
            this.service = service;

            // set up a cache, we'll use it for the permissions
            // in order to reduce latency and traffic
            this.cache = new Cachd({
                  ttl: 3600000 // 1h
                , maxLength: 10000
                , removalStrategy: 'leastUsed'
            });

            // cache the combination of tokens
            this.instanceCache = new Cachd({
                  ttl: 300000 // 30 seconds
                , maxLength: 10000
                , removalStrategy: 'leastUsed'
            });


            // null permissions for returnquests lacking a token
            this.nullPermission = new PermissionInstance([]);


            // rat elimtis are managed on a per service base
            this.rateLimitManager = new RateLimitManager(this.service);


            if (learningSession) {
                this.learner = new PermissionLearner(this.service, this);
            }
        }







        load() {
            this.tokenManager = new PermissionTokenManager(this.service);

            return this.tokenManager.load().then((token) => {
                this.serviceToken = token;
                return Promise.resolve(token);
            });
        }








        learn(service, resource, action, roles) {
            if (this.learner) this.learner.learn(service, resource, action, roles);
        }








        getPermissions(tokens) {
            if (type.array(tokens) && tokens.length) {
                const cacheId = tokens.sort().join(':');


                // maybe the combinition fo token permissions
                // was cached already
                if (this.instanceCache.has(cacheId)) return this.instanceCache.get(cacheId);
                else {
                    const instancePromise = new Promise((resolve, reject) => {
                        // load permission for the individual tokens
                        // either from the cache or from the permissions
                        // service
                        return Promise.all(tokens.map((token) => {

                            if (this.cache.has(token)) return this.cache.get(token);
                            else {
                                const promise = this.loadPermission(token).catch((err) => {

                                    // dont cache errors
                                    this.cache.remove(token);

                                    return Promise.reject(err);
                                });

                                // cache the promise, not tha value
                                this.cache.set(token, promise);


                                return promise;
                            }
                        })).then((permissionPormises) => {


                            // we're getting promises, wait for all to
                            // be resolved
                            return Promise.all(permissionPormises).then((permissions) => {


                                // filter empty ones and create a new instance
                                resolve(new PermissionInstance(permissions.filter(p => type.object(p))));
                            });
                        }).catch((err) => {

                            // dont cache this one, we should cache errors, but not too long. 
                            // yes, this is a todo :D
                            this.instanceCache.remove(cacheId);

                            reject(err);
                        });
                    });


                    // cache the promise
                    this.instanceCache.set(cacheId, instancePromise);


                    return instancePromise;
                }
            } else return Promise.resolve(this.nullPermission);
        }






        loadPermission(token) {
            return new RelationalRequest({
                  service       : 'permissions'
                , resource      : 'authorization'
                , resourceId    : token
                , selection     : ['*']
                , action        : 'listOne'
            }).send(this.service).then((response) => {
                if (response.status === 'ok' || response.status === 'notFound') return Promise.resolve(response.data);
                else return Promise.reject(response.toError());
            }).catch(err => Promise.reject(new Error(`Failed to load permissions: ${err.message}`)));
        }
    }
})();
