(function() {
    'use strict';

    const log               = require('ee-log');
    const type              = require('ee-types');





    module.exports = class Restriction {


        constructor(restriction) {

            // set flags
            this.nullable = !!restriction.nullable;
            this.global = !!restriction.global;

            // the value
            if (restriction.value === undefined) throw new Error('The value of a row restriction cannot be undefined!');
            else this.value = restriction.value;

            // the value
            if (restriction.property === undefined) throw new Error('The property of a row restriction cannot be undefined!');
            else {
                if (restriction.property.indexOf('.') >= 0) {
                    this.property = restriction.property.slice(restriction.property.lastIndexOf('.')+1);
                    this.path = restriction.property.slice(0, restriction.property.lastIndexOf('.')).split('.');
                }
                else this.property = restriction.property;

                // store the originla value
                this.fullPath = restriction.property;
            }

            // the comparator
            if (!restriction.comparator) throw new Error('The restriction needs a comparator!');
            else this.comparator = restriction.comparator;

            // the type
            if (!restriction.valueType) throw new Error('The restriction needs a valueType!');
            else this.type = restriction.valueType;


            // now its time to set up the entites
            this.resources = new Set(restriction.resources);
        }



        /**
         * checks wether this restirction must be applied to an resource
         * if the restriction is global this is always false
         *
         * @param {string} resource the name of the resource to look for
         *
         * @returns {boolean} true if this restriction must be applied
         *                    to the resource
         */
        hasResource(resource) {
            return this.global ? false : !!this.resources.has(resource);
        }




        isGlobal() {
            return this.global;
        }
    }
})();
