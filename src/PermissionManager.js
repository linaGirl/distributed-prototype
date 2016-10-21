(function() {
    'use strict';

    const RelationalRequest         = require('./RelationalRequest');
    const FilterBuilder             = require('./FilterBuilder');
    const PermissionInstance        = require('./PermissionInstance');
    const PermissionLearner         = require('./PermissionLearner');
    const PermissionTokenManager    = require('./PermissionTokenManager');


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
                  ttl: 30000 // 30 seconds
                , maxLength: 10000
                , removalStrategy: 'leastUsed'
            });

            // null permissions for tokenless requests
            this.nullPermissions = new Map();


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






        getCacheKey(tokens, serviceName, resourceName, actionName) {
            const actionId = this.getActionId(serviceName, resourceName, actionName);


            if (type.array(tokens)) return crypto.createHash('md5').update(`${tokens.sort().join(':')}/${actionId}`).digest('hex');
            else return crypto.createHash('md5').update(`${tokens}/${actionId}`).digest('hex');
        }




        getActionId(serviceName, resourceName, actionName) {
            return `${serviceName}::${resourceName}:${actionName}`;
        }





        // 1. check for .tokens.json in project root
        // 2. ask user for root pw
        // 3. check for service token
        // 4. load groups, let user select
        // 5. create token, store in .tokens.json





        getActionPermissions(request) {
            const tokens        = request.tokens;
            const serviceName   = request.service;
            const resourceName  = request.resource;
            const actionName    = request.action;


            if (type.array(tokens) && tokens.length) {
                const cacheId = this.getCacheKey(tokens, serviceName, resourceName, actionName);

                if (this.instanceCache.has(cacheId)) return Promise.resolve(this.instanceCache.get(cacheId));
                else {
                    return Promise.all(tokens.map((token) => {
                        const tokenCacheId = this.getCacheKey(token, serviceName, resourceName, actionName);

                        if (this.cache.has(tokenCacheId)) return Promise.resolve(this.cache.get(tokenCacheId));
                        else {
                            return this.loadPermission(token, serviceName, resourceName, actionName).then((data) => {
                                const permission = this.preparePermission(data, serviceName, resourceName, actionName);

                                // add to tokencache
                                if (!learningSession) this.cache.set(tokenCacheId, permission);

                                // return
                                return Promise.resolve(permission);
                            });
                        }
                    })).then((permissions) => {
                        // it's entierly possible that the permissions
                        // result was empty, fitler those items
                        permissions = permissions.filter(k => !!k);


                        const instance = new PermissionInstance({
                              permissions       : permissions
                            , serviceName       : serviceName
                            , resourceName      : resourceName
                            , actionName        : actionName
                            , manager           : this
                        });

                        // add to instancecache
                        if (!learningSession) this.instanceCache.set(cacheId, instance);

                        // return to user
                        return Promise.resolve(instance);
                    });
                }
            } else {
                const nullCacheId = this.getActionId(serviceName, resourceName, actionName);

                if (!this.nullPermissions.has(nullCacheId)) {
                    this.nullPermissions.set(nullCacheId, new PermissionInstance({
                          permissions       : []
                        , serviceName       : serviceName
                        , resourceName      : resourceName
                        , actionName        : actionName
                        , manager           : this
                    }));
                }

                if (serviceName !== 'permissions' && resourceName !== 'authorization') {
                    console.log('Request '.grey+'without'.yellow.bold+' token on '.grey+serviceName.green.bold+'/'.grey+resourceName.magenta.bold+':'.grey+actionName.blue.bold+' issued by '.grey+(request.requestingService || '(unknown)').green.bold+'/'.grey+(request.requestingResource || 'unknown').magenta.bold);
                }

                return Promise.resolve(this.nullPermissions.get(nullCacheId));
            }
        }






        preparePermission(permission, serviceName, resourceName, actionName) {
            if (permission && permission.length) {
                const item = permission[0];

                if (item.permissions && item.permissions.length) {
                    item.permissions = item.permissions.filter((entry) => {
                        return entry.service === serviceName &&
                            entry.resource === resourceName &&
                            entry.action === actionName;
                    });
                }

                return item;
            }
            return undefined;
        }






        loadPermission(token, serviceName, resourceName, actionName) {
            return new RelationalRequest({
                  service       : 'permissions'
                , resource      : 'authorization'
                , resourceId    : token
                , selection     : ['*']
                , action        : 'listOne'
                , data: {
                      serviceName   : serviceName
                    , resourceName  : resourceName
                    , actionName    : actionName
                }
            }).send(this.service).then((response) => {
                if (response.status === 'ok') return Promise.resolve(response.data);
                else return Promise.reject(new Error(`request failed, response status ${response.status}!`));
            }).catch(err => Promise.reject(new Error(`Failed to load permissions: ${err.message}`)));
        }
    }
})();
