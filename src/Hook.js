(function() {
    'use strict';




    const log = require('ee-log');
    const debug = process.argv.includes('--debug-service');





    module.exports = class Hook {

        constructor() {
            this.hooks = new Map();
        }



        executeHook(name, ...args) {
            if (this.hooks.has(name)) {
                const hooks = this.hooks.get(name);

                const execute = (index = 0) => {
                    if (hooks.length > index) {
                        return Promise.resolve().then(() => {
                            const listener = hooks[index];
                            let returnValue;

                            try {
                                returnValue = listener.apply(null, args);
                            } catch(err) {
                                if (debug) log(err);
                                return Promise.reject(err);
                            }

                            if (returnValue instanceof Error) {
                                if (debug) log(returnValue);
                                return Promise.reject(err);
                            }
                            if (typeof returnValue === 'object' && typeof returnValue.then === 'function') return returnValue;
                            else return Promise.resolve();
                        }).then(() => {
                            return execute(index+1);
                        });
                    } else return Promise.resolve();
                };


                return execute();
            } else return Promise.resolve();
        }



        hasHooks(name) {
            return this.hooks.has(name) && this.hooks.get(name).length;
        }



        clearHooks(hookName) {
            if (hookName) {
                if (this.hooks.has(hookName)) {
                    const hooks = this.hooks.get(hookName);
                    hooks.splice(0, hooks.length);
                }
            } else this.hooks.clear();
            return Promise.resolve();
        }



        storeHook(hookName, listener) {
            if (!this.hooks.has(hookName)) this.hooks.set(hookName, []);
            this.hooks.get(hookName).push(listener);
        }
    }
})();
