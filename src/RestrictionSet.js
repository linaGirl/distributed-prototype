(function() {
    'use strict';

    const log               = require('ee-log');
    const type              = require('ee-types');
    const Restriction       = require('./Restriction');





    module.exports = class RestrictionSet {


        constructor(restrictions) {
            this.globalRestrictions = [];
            this.restrictions = [];

            restrictions.forEach((restriction) => {
                const instance = new Restriction(restriction);

                if (instance.isGlobal()) this.globalRestrictions.push(restriction);
                else this.restrictions.push(instance);
            });
        }



        getGlobal() {
            return this.globalRestrictions;
        }




        get() {
            return this.restrictions;
        }
    }
})();
