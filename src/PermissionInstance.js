(function() {
    'use strict';

    const log = require('ee-log');
    const type = require('ee-types');


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

            // those objects get shared betweenaction calls, dont ever
            // let them be modified!
            Object.freeze(this);
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

            const cacheId = `user:${id}`;

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
            const cacheId = `service:${id}`;

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
            const cacheId = `app:${id}`;

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







        isActionAllowed() {
            if (this.resourceName === 'authorization' && this.actionName === 'listOne' && this.serviceName === 'permissions') return true;
            else {
                if (this.actionIsAllowed) return true;
                else {

                    // check if we're learning
                    if (learningSession) this.manager.learn(this.serviceName, this.resourceName, this.actionName, Array.from(this.getRoles()));

                    return allowAll ? true : false;
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
