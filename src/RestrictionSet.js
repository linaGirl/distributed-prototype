(function() {
    'use strict';

    const log               = require('ee-log');
    const type              = require('ee-types');
    const Restriction       = require('./Restriction');





    module.exports = class RestrictionSet {


        constructor(restrictions) {
            this.globalRestrictions = new Map();
            this.restrictions = new Map();

            restrictions.forEach((restriction) => {
                const instance = new Restriction(restriction);

                if (instance.isGlobal()) {
                    
                }
                else {
                    if (!this.restrictions.has(instance.getResourceName())) this.restrictions.set(instance.getResourceName(), []);
                    this.restrictions.get(instance.getResourceName()).push(instance);
                }
            });
        }



        getGlobal(action) {
            return this.global;
        }




        get(resourceName, action) {
            return this.restrictions.has(resourceName, action) ? this.restrictions.get(resourceName, action) : [];
        }
    }
})();
