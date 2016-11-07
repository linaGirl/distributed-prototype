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
                  ttl: 300000 // 30 seconds
                , maxLength: 10000
                , removalStrategy: 'leastUsed'
            });

            // null permissions for tokenless requests
            this.nullPermissions = new Map();



            // queue for permissions that are currentl ybeeing loaded
            this.loaderQueue = new Map();


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









        getPermissions(tokens, serviceName, resourceName, actionName, request) {
            if (type.array(tokens) && tokens.length) {
                const cacheId = this.getCacheKey(tokens, serviceName, resourceName, actionName);

                if (this.instanceCache.has(cacheId)) return Promise.resolve(this.instanceCache.get(cacheId));
                else {
                    return Promise.all(tokens.map((token) => {
                        const tokenCacheId = this.getCacheKey(token, serviceName, resourceName, actionName);

                        if (this.cache.has(tokenCacheId)) return Promise.resolve(this.cache.get(tokenCacheId));
                        else if (this.loaderQueue.has(tokenCacheId)) {

                            // the permissions are already beeing loaded
                            // wait for the other call to return
                            return new Promise((resolve, reject) => {
                                this.loaderQueue.get(tokenCacheId).push({
                                      resolve   : resolve
                                    , reject    : reject
                                });
                            });
                        }
                        else {
                            // mark as loading
                            this.loaderQueue.set(tokenCacheId, []);

                            // get from service
                            return this.loadPermission(token, serviceName, resourceName, actionName).then((data) => {
                                const permission = this.preparePermission(data, serviceName, resourceName, actionName);

                                // add to tokencache
                                if (!learningSession) this.cache.set(tokenCacheId, permission);

                                // return all other calls in
                                // the correct order
                                process.nextTick(() => {
                                    this.loaderQueue.get(tokenCacheId).forEach(promise => promise.resolve(permission));

                                    // remove, we're done
                                    this.loaderQueue.delete(tokenCacheId);
                                });

                                // return
                                return Promise.resolve(permission);
                            }).catch((err) => { //log(err);

                                // return to all waiting parties
                                process.nextTick(() => {
                                    this.loaderQueue.get(tokenCacheId).forEach(promise => promise.resolve());

                                    // remove, we're done
                                    this.loaderQueue.delete(tokenCacheId);
                                });


                                return Promise.resolve();
                            });
                        }
                    })).then((permissions) => { // log(tokens, permissions);
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

                if (learningSession && serviceName !== 'permissions' && resourceName !== 'authorization') {
                    let requestingService = '[unknown]';
                    let requestingResource = '[unknown]';

                    if (request) {
                        if (request.requestingService) requestingService = request.requestingService;
                        if (request.requestingResource) requestingResource = request.requestingResource;
                    }

                    console.log('Request '.grey+'without'.yellow.bold+' token on '.grey+serviceName.green.bold+'/'.grey+resourceName.magenta.bold+':'.grey+actionName.blue.bold+' issued by '.grey+requestingService.green.bold+'/'.grey+requestingResource.magenta.bold);
                }

                return Promise.resolve(this.nullPermissions.get(nullCacheId));
            }
        }







        getActionPermissions(request) {
            const tokens        = request.tokens;
            const serviceName   = request.service;
            const resourceName  = request.resource;
            const actionName    = request.action;


            return this.getPermissions(tokens, serviceName, resourceName, actionName, request);
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
