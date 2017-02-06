(function() {
    'use strict';

    const log               = require('ee-log');
    const type              = require('ee-types');
    const RestrictionSet    = require('./RestrictionSet');


    const allowAll = process.env.allowAll || process.argv.some(a => a === '--allow-all' ||  a === '--no-permissions');
    const learningSession = process.env.learnPermissions || process.argv.some(a => a === '--learn-permissions');




    const hasProperty = (obj, property) => {
        return type.object(obj) && Object.hasOwnProperty.call(obj, property);
    };

    const hasData = (obj) => {
        return type.object(obj) && Object.keys(obj).length;
    }











    module.exports = class PermissionInstance {


        constructor(permissions, type) {

            // the permissions a received from the
            // permission service
            this.permissions = permissions || [];

            // the type if this is a subset of the permissions
            // filtered by subject type
            this.type = type || 'root';


            // cache the question if a certain action is allowef
            this.allowedCache = new Map();


            // cache row restrictions stuff
            this.restrictionsCache = new Map();
            this.restrictionsAvailabilityCache = new Map();

            // cahce instances
            this.instanceCache = new Map();


            // those objects get shared between action calls, dont ever
            // let them be modified!
            Object.freeze(this);
        }





        /**
         * returns all the tokens that are part 
         * of this permission configuration
         */
        getTokens() {
            return this.permissions.map(p => p.token);
        }






/*


        getRestrictions() {
            if (!this.restrictions) {
                const list = [];

                this.permissions.forEach((permission) => {
                    permission.restrictions.forEach(r => list.push(r));
                });

                this.restrictions = new RestrictionSet(list);
            }

            return this.restrictions;
        }


*/

/*
        mapify(input) {
            if (type.object(input)) {
                const map = new Map();

                Object.keys(input).forEach(k => map.set(k, input[k]));

                return map;
            } else return input;
        }

*/

    
        
        /**
         * filter the set of permissions by the user type
         */
        users(id) {
            if (this.type !== 'root') throw new Error(`Cannot get users from permissions, you're already working on a user set!`);

            const cacheId = `user:${(id || '[all]')}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.subject.type === 'user' && (type.undefined(id) || p.subject.id == id);
                }), 'user');

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }


        
        /**
         * filter the set of permissions by the service type
         */
        services(id) {
            if (this.type !== 'root') throw new Error(`Cannot get services from permissions, you're already working on a user service!`);
            const cacheId = `service:${(id || '[all]')}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.subject.type === 'service' && (type.undefined(id) || p.id == id);
                }), 'service');

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }


        
        /**
         * filter the set of permissions by the app type
         */
        apps(id) {
            if (this.type !== 'root') throw new Error(`Cannot get apps from permissions, you're already working on a app set!`);
            const cacheId = `app:${(id || '[all]')}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.subject.type === 'app' && (type.undefined(id) || p.id == id);
                }), 'app');

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }



        
        /**
         * filter the set of permissions by the external type
         */
        external() {
            if (this.type !== 'root') throw new Error(`Cannot get external from permissions, you're already working on an external set!`);
            const cacheId = `external:[all]`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.subject.type === 'app' || p.subject.type === 'user';
                }), 'external');

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }


        
        /**
         * filter the set of permissions by the token type
         */
        token(token) {
            if (this.type !== 'root') throw new Error(`Cannot get token from permissions, you're already working on a token set!`);
            const cacheId = `token:${token}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.token === token;
                }), 'token');

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }





        hasApp() {
            return this.permissions.some(p => p.subject.type === 'app');
        }

        isApp() {
            return !this.permissions.some(p => p.subject.type !== 'app');
        }





        hasService() {
            return this.permissions.some(p => p.subject.type === 'service');
        }

        isService() {
            return !this.permissions.some(p => p.subject.type !== 'service');
        }





        hasUser() {
            return this.permissions.some(p => p.subject.type === 'user');
        }

        isUser() {
            return !this.permissions.some(p => p.subject.type !== 'user');
        }







        isAuthenticated() {
            return this.permissions.length;
        }






        /**
         * checks if a certain action is allowed
         */
        isActionAllowed(service, resource, actionName) {

            // we need all the information for making the decisions
            if (!type.string(service) || !service.length) return false;
            if (!type.string(resource) || !resource.length) return false;
            if (!type.string(actionName) || !actionName.length) return false;

            // whitelist some endpoints
            if (resource === 'authorization' && actionName === 'listOne' && service === 'permissions') return true;
            if (resource === 'serviceInfo' && actionName === 'listOne' && service === 'user') return true;
            if (resource === 'appInfo' && actionName === 'listOne' && service === 'user') return true;
            if (resource === 'userInfo' && actionName === 'listOne' && service === 'user') return true;


            const cacheId = `${service}/${resource}:${actionName}`;


            // action specific permissions
            if (allowAll) return true;
            else if (this.allowedCache.has(cacheId) && this.allowedCache.get(cacheId)) return true;
            else {
                const isAllowed = this.permissions.some((permission) => {
                    return permission.roles && permission.roles.some((role) => {
                        return role.permissions && role.permissions.some((p) => {
                            return p.service === service && p.resource === resource && p.action === actionName;
                        });
                    });
                });

                // cache for later use
                this.allowedCache.set(cacheId, isAllowed);

                return isAllowed;
            }
        }







        getRateLimitCredits() {
            return this.manager.rateLimitManager.getCredits(this);
        }




        getRateLimitInfo() {
            return this.manager.rateLimitManager.getInfo(this);
        }




        payRateLimit(amount) {
            return this.manager.rateLimitManager.pay(this, amount);
        }




        /**
         * returns the rate limit with the lowest values
         * for all tokens
         */
        getRateLimits() {
            return this.permissions.filter(p => !!p.rateLimit).map(p => Object.assign({token: p.token}, p.rateLimit));
        }








        hasRole(roleName) {
            return this.permissions.some(p => p.roles && p.roles.some(r => r.identifier === roleName));
        }

        getRoles() {
            const roles = new Set();
                
            // get all roles
            this.permissions.forEach(p => p.roles && p.roles.forEach(r => roles.add(r.identifier)));

            return roles;
        }







        hasCapability(name) {
            return this.permissions.some(p => p.roles && p.roles.some(r => r.capabilities && r.capabilities.some(c => c === name)));
        }

        getCapabilities() {
            const capabilities = new Set();

            // get all capabilities
            this.permissions.forEach(p => p.roles && p.roles.forEach(r => r.capabilities && r.capabilities.forEach(c => capabilities.add(c))));

            return capabilities;
        }






        hasValue(valueName) {
            const value = this.getValue(valueName);
            return value !== undefined && value !== null;
        }


        getValue(valueName) {
            for (const permission of this.permissions) {
                if (hasProperty(permission.subject.data, valueName)) return permission.subject.data[valueName];
            }

            return undefined;
        }

        getValues(valueName) {
            const values = new Set();

            for (const permission of this.permissions) {
                if (hasProperty(permission.subject.data, valueName)) values.add(permission.subject.data[valueName]);
            }

            return values;
        }


        getAllValues() {
            const values = new Set();

            for (const permission of this.permissions) {
                if (hasData(permission.subject.data)) {
                    const map = new Map();

                    Object.keys(permission.subject.data).forEach((key) => {
                        map.set(key, permission.subject.data[key]);
                    });

                    values.add(map);
                }
            }

            return values;
        }

        getUniqueValues() {
            const values = new Map();

            for (const permission of this.permissions) {
                if (hasData(permission.subject.data)) {
                    Object.keys(permission.subject.data).forEach((key) => {
                        values.set(key, permission.subject.data[key]);
                    });
                }
            }

            return values;
        }






        hasRowRestrictions(actionName) {
            if (!actionName) {
                log(new Error(`Call on hasRowRestrictions without an actionName!`));
            }

            if (this.restrictionsAvailabilityCache.has(actionName)) return this.restrictionsAvailabilityCache.get(actionName);
            else {
                this.restrictionsAvailabilityCache.set(actionName, this.permissions.some(p => p.roles.some(role => role.restrictions.some((res) => {
                    return res.actions.includes(actionName);
                }))));

                return this.restrictionsAvailabilityCache.get(actionName);
            }
        }




        getRowRestrictions(actionName) {
            if (this.hasRowRestrictions(actionName)) {
                if (this.restrictionsCache.has(actionName)) return this.restrictionsCache.get(actionName);
                else {
                    const restrictions = [];

                    for (const permission of this.permissions) {
                        for (const role of permission.roles) {
                            if (role.restrictions) {
                                for (const restriction of role.restrictions) {
                                    if (restriction.actions.includes(actionName)) {
                                        restrictions.push({
                                              name      : restriction.name
                                            , global    : restriction.global
                                            , nullable  : restriction.nullable
                                            , value     : restriction.value
                                            , property  : restriction.property
                                            , comparator: restriction.comparator
                                            , valueType : restriction.valueType
                                            , resources : restriction.resources.map(r => r.identifier)
                                        });
                                    }
                                    
                                }
                            }
                        }
                    }

                    this.restrictionsCache.set(actionName, restrictions);
                    return this.restrictionsCache.get(actionName);
                }
            } else return [];
        }
    }
})();
