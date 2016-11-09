(function() {
    'use strict';

    const log               = require('ee-log');
    const type              = require('ee-types');
    const RestrictionSet    = require('./RestrictionSet');


    const allowAll = process.env.allowAll || process.argv.some(a => a === '--allow-all' ||  a === '--no-permissions');
    const learningSession = process.env.learnPermissions || process.argv.some(a => a === '--learn-permissions');






    module.exports = class PermissionInstance {


        constructor(options) {
            const permissions = options.permissions;

            this.serviceName = options.serviceName;
            this.resourceName = options.resourceName;
            this.actionName = options.actionName;


            if (permissions) {
                if (!type.array(permissions)) throw new Error(`Expected an permissions array, got ${type(permissions)}!`);

                permissions.forEach((permission) => {

                    // convert incomin items
                    if (type.array(permission.capabilities))    permission.capabilities = new Set(permission.capabilities);
                    if (type.array(permission.roles))           permission.roles        = new Set(permission.roles);
                    if (type.object(permission.data))           permission.data         = this.mapify(permission.data);


                    if (!type.set(permission.capabilities)) throw new Error(`Permissions: expected a set on the capability property, got ${type(permission.capabilities)}!`);
                    if (!type.map(permission.data)) throw new Error(`Permissions: expected a map on the data property, got ${type(permission.data)}!`);
                    if (!type.set(permission.roles)) throw new Error(`Permissions: expected a set on the roles property, got ${type(permission.roles)}!`);
                });
            }

            this.permissions = permissions || [];
            if (!options.isChild) this.instanceCache = new Map();
            this.isChild = !!options.isChild;

            // hidden
            Object.defineProperty(this, 'manager', {value: options.manager});

            // check it the action is allowed
            this.actionIsAllowed = this.permissions.some((permissions) => {
                return permissions.permissions.some((permission) => {
                    return permission.action === this.actionName &&
                        permission.service === this.serviceName &&
                        permission.resource === this.resourceName &&
                        permission.allowed;
                });
            });


            // cache roles
            this._roles = new Set();

            for (const permission of this.permissions) {
                for (const role of permission.roles) this._roles.add(role);
            }


            // those objects get shared betweenaction calls, dont ever
            // let them be modified!
            Object.freeze(this);
        }





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





        mapify(input) {
            if (type.object(input)) {
                const map = new Map();

                Object.keys(input).forEach(k => map.set(k, input[k]));

                return map;
            } else return input;
        }





        users(id) {
            if (this.isChild) throw new Error(`Cannot get users from permissions, you're already working on a user set!`);

            const cacheId = `user:${(id || '[all]')}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance({
                    permissions: this.permissions.filter((p) => {
                        return p.type === 'user' && (type.undefined(id) || p.id == id);
                    })
                    , isChild: true
                    , manager: this.manager
                    , serviceName: this.serviceName
                    , resourceName: this.resourceName
                    , actionName: this.actionName
                });

                this.instanceCache.set(cacheId, instance);
            }
            return this.instanceCache.get(cacheId);
        }


        services(id) {
            if (this.isChild) throw new Error(`Cannot get services from permissions, you're already working on a user service!`);
            const cacheId = `service:${(id || '[all]')}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance({
                    permissions: this.permissions.filter((p) => {
                        return p.type === 'service' && (type.undefined(id) || p.id == id);
                    })
                    , isChild: true
                    , manager: this.manager
                    , serviceName: this.serviceName
                    , resourceName: this.resourceName
                    , actionName: this.actionName
                });

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }


        apps(id) {
            if (this.isChild) throw new Error(`Cannot get apps from permissions, you're already working on a app set!`);
            const cacheId = `app:${(id || '[all]')}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance({
                    permissions: this.permissions.filter((p) => {
                        return p.type === 'app' && (type.undefined(id) || p.id == id);
                    })
                    , isChild: true
                    , manager: this.manager
                    , serviceName: this.serviceName
                    , resourceName: this.resourceName
                    , actionName: this.actionName
                });

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }


        token(token) {
            if (this.isChild) throw new Error(`Cannot get token from permissions, you're already working on a token set!`);
            const cacheId = `token:${token}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.token === token;
                }), true, this.manager);

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }





        hasApp() {
            return this.permissions.some(p => p.type === 'app');
        }

        isApp() {
            return !this.permissions.some(p => p.type !== 'app');
        }





        hasService() {
            return this.permissions.some(p => p.type === 'service');
        }

        isService() {
            return !this.permissions.some(p => p.type !== 'service');
        }





        hasUser() {
            return this.permissions.some(p => p.type === 'user');
        }

        isUser() {
            return !this.permissions.some(p => p.type !== 'user');
        }







        isAuthenticated() {
            return this.permissions.length;
        }







        isActionAllowed(actionName) {
            if (this.resourceName === 'authorization' && this.actionName === 'listOne' && this.serviceName === 'permissions') return true;
            if (this.resourceName === 'serviceInfo' && this.actionName === 'listOne' && this.serviceName === 'user') return true;
            if (this.resourceName === 'appInfo' && this.actionName === 'listOne' && this.serviceName === 'user') return true;
            if (this.resourceName === 'userInfo' && this.actionName === 'listOne' && this.serviceName === 'user') return true;
            else {
                if (actionName) {

                    // action specific permissions
                    return this.permissions.some((permissions) => {
                        return permissions.permissions.some((permission) => {
                            return permission.action === actionName &&
                                permission.service === this.serviceName &&
                                permission.resource === this.resourceName &&
                                permission.allowed;
                        });
                    }) || allowAll;
                } else {

                    // default action this instance was loaded for
                    if (this.actionIsAllowed) return true;
                    else {

                        // check if we're learning
                        if (learningSession) this.manager.learn(this.serviceName, this.resourceName, this.actionName, Array.from(this.getRoles()));

                        return allowAll ? true : false;
                    }
                }
            }
        }







        hasRole(roleName) {
            for (const permission of this.permissions) {
                if (permission.roles.has(roleName)) return true;
            }

            return false;
        }

        getRoles() {
            return this._roles;
        }







        hasCapability(name) {
            for (const permission of this.permissions) {
                if (permission.capabilities.has(name)) return true;
            }

            return false;
        }

        getCapabilities() {
            const capabilities = new Set();

            for (const permission of this.permissions) {
                for (const capability of permission.capabilities) capabilities.add(capability);
            }

            return capabilities;
        }






        hasValue(valueName) {
            return !type.undefined(this.getValue(valueName));
        }


        getValue(valueName) {
            for (const permission of this.permissions) {
                if (permission.data.has(valueName)) return permission.data.get(valueName);
            }

            return undefined;
        }

        getValues(valueName) {
            const values = new Set();

            for (const permission of this.permissions) {
                if (permission.data.has(valueName)) values.add(permission.data.get(valueName));
            }

            return values;
        }


        getAllValues() {
            const values = new Set();

            for (const permission of this.permissions) {
                if (permission.data.size) values.add(permission.data);
            }

            return values;
        }

        getUniqueValues() {
            const values = new Map();

            for (const permission of this.permissions) {
                if (permission.data.size) {
                    for (const key of permission.data.keys()) {
                        values.set(key, permission.data.get(key));
                    }
                }
            }

            return values;
        }






        hasRowRestrictions() {
            return this.permissions.some(p => p.restrictions && p.restrictions.length);
        }




        getRowRestrictions() {
            const restrictions = [];

            for (const permission of this.permissions) {
                if (permission.restrictions) {
                    for (const restriction of permission.restrictions) {
                        restrictions.push(restriction);
                    }
                }
            }

            return restrictions;
        }
    }
})();
