(function() {
    'use strict';



    const log = require('ee-log');




    module.exports = class RelatedResourceDefinition {



        constructor(options) {
            if (options) {
                if (options.primaryIds) this.setPrimaryIds(options.primaryIds);
                if (options.name) this.name = options.name;
            }

            this.properties = new Map();
        }



        addProperty(name, definition) {
            this.properties.set(name, {
                  name              : name
                , type              : definition.type
                , representation    : definition.representation
                , nullable          : !!definition.nullable
                , isPrimary         : definition.isPrimary
            });
        }


        hasProperty(propertyName) {
            return this.properties.has(propertyName);
        }


        getProperty(propertyName) {
            return this.properties.get(propertyName);
        }


        get primaryId() {
            if (this.hasPrimaryId()) return this.primaryIds[0];
            else throw new Error(`Cannot return the primary id on the resource ${this.name} becuse there is no or multiple primary ids!`);
        }


        hasPrimaryId() {
            return this.primaryIds && this.primaryIds.length === 1;
        }


        hasPrimaryIds() {
            return this.primaryIds && this.primaryIds.length >= 1;
        }


        setPrimaryIds(primaryIds) {
            this.primaryIds = primaryIds.sort();
        }
    }
})();
