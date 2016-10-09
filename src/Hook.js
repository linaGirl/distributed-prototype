(function() {
    'use strict';




    const log = require('ee-log');





    module.exports = class Hook {

        constructor() {
            this.hooks = new Map();
        }



        executeHook(name, ...args) {
            if (this.hooks.has(name)) {
                return Promise.all(this.hooks.get(name).map((listener) => {
                    const returnValue = listener.apply(null, args);

                    if (typeof returnValue === 'object' && typeof returnValue.then === 'function') return returnValue;
                    else return Promise.resolve();
                }));
            } else return Promise.resolve();
        }



        hasHooks(name) {
            return this.hooks.has(name) && this.hooks.get(name).length;
        }



        clearHooks() {
            this.hooks.clear();
            return Promise.resolve();
        }



        storeHook(hookName, listener) {
            if (!this.hooks.has(hookName)) this.hooks.set(hookName, []);
            this.hooks.get(hookName).push(listener);
        }
    }
})();
