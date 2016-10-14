(function() {
    'use strict';

    const log = require('ee-log');
    const RelationalRequest = require('./RelationalRequest');
    const FilterBuilder = require('./FilterBuilder');
    const PermissionInstance = require('./PermissionInstance');
    const Cachd = require('cachd');
    const type = require('ee-types');



    module.exports = class PermissionManager {


        constructor(target) {
            this.target = target;

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
            this.nullPermission = new PermissionInstance();
        }



        getPermissions(tokens) {
            if (type.array(tokens) && tokens.length) {
                const id = tokens.sort().join(':');

                if (this.instanceCache.has(id)) return this.instanceCache.get(id);
                else {
                    return Promise.all(tokens.map((token) => {
                        if (this.cache.has(token)) return Promise.resolve(this.cache.get(token));
                        else {
                            return this.loadPermission(token).then((data) => {
                                const permission = this.preparePermission(data);

                                // add to tokencache
                                this.cache.set(token, permission);

                                // return
                                return Promise.resolve(permission);
                            });
                        }
                    })).then((permissions) => {
                        const instance = new PermissionInstance(permissions);

                        // add to instancecache
                        this.instanceCache.set(instance);

                        // return t user
                        return Promise.resolve(instance);
                    });
                }
            } else return Promise.resolve(this.nullPermission);
        }



        preparePermission(permission) {
            return permission && permission.length ? permission[0] : undefined;
        }



        loadPermission(token) {
            return new RelationalRequest({
                  service       : 'permissions'
                , resource      : 'permission'
                , resourceId    : token
                , selection     : ['*']
                , action        : 'list'
            }).send(this.target).then((response) => {
                if (response.status === 'ok') return Promise.resolve(response.data);
                else return Promise.reject(new Error(`request failed, response status ${response.status}!`));
            }).catch(err => Promise.reject(new Error(`Failed to load permissions: ${err.message}`)));
        }
    }
})();
