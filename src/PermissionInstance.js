(function() {
    'use strict';

    const log = require('ee-log');
    const type = require('ee-types');


    const allowAll = process.env.allowAll || process.argv.some(a => a === '--allow-all' ||  a === '--no-permissions');


    module.exports = class PermissionInstance {


        constructor(permissions, isChild) {
            if (permissions) {
                if (!type.array(permissions)) throw new Error(`Expected an permissions array, got ${type(permissions)}!`);

                permissions.forEach((permission) => {
                    if (!type.set(permission.capabilities)) throw new Error(`Permissions: expected a set on the capability property, got ${type(permission.capabilities)}!`);
                    if (!type.map(permission.data)) throw new Error(`Permissions: expected a map on the data property, got ${type(permission.data)}!`);
                    if (!type.set(permission.roles)) throw new Error(`Permissions: expected a set on the roles property, got ${type(permission.roles)}!`);
                    if (!type.map(permission.permissions)) throw new Error(`Permissions: expected a map on the permissions property, got ${type(permission.permissions)}!`);
                });
            }

            this.permissions = permissions || [];
            if (!isChild) this.instanceCache = new Map();
            this.isChild = !!isChild;

            // those objects get shared betweenaction calls, dont ever
            // let them be modified!
            Object.freeze(this);
        }





        users(id) {
            if (this.isChild) throw new Error(`Cannot get users from permissions, you're already working on a user set!`);

            const cacheId = `user:${id}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.type === 'user' && (type.undefined(id) || p.id == id);
                }), true);

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }


        services(id) {
            if (this.isChild) throw new Error(`Cannot get services from permissions, you're already working on a user service!`);
            const cacheId = `service:${id}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.type === 'service' && (type.undefined(id) || p.id == id);
                }), true);

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }


        apps(id) {
            if (this.isChild) throw new Error(`Cannot get apps from permissions, you're already working on a app set!`);
            const cacheId = `app:${id}`;

            if (!this.instanceCache.has(cacheId)) {
                const instance = new PermissionInstance(this.permissions.filter((p) => {
                    return p.type === 'app' && (type.undefined(id) || p.id == id);
                }), true);

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
                }), true);

                this.instanceCache.set(cacheId, instance);
            }

            return this.instanceCache.get(cacheId);
        }





        isActionAllowed(resourceName, actionName) {
            if (allowAll) return true;
            else {
                for (const permission of this.permissions) {
                    if (permission.permissions.has(resourceName)) {
                        const resource =  permission.permissions.get(resourceName);

                        if (resource.has(actionName)) {
                            const action = action.get(actionName);

                            if (action.allowed) return true;
                        }
                    }
                }

                return false;
            }
        }







        hasRole(roleName) {
            for (const permission of this.permissions) {
                if (permission.roles.has(roleName)) return true;
            }

            return false;
        }

        getRoles() {
            const roles = new Set();

            for (const permission of this.permissions) {
                for (const role of permission.roles) roles.add(role);
            }

            return roles;
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
    }
})();
