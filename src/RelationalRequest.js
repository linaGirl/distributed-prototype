(function() {
    'use strict';



    const Request = require('./Request');
    const RelationalResponse = require('./RelationalResponse');
    const type = require('ee-types');
    const log = require('ee-log');



    module.exports = class RelationalRequest extends Request {


        constructor(options) {
            super(options);

            if (type.object(options)) {
                if (options.resourceId)             this.resourceId = options.resourceId;
                if (options.remoteResource)         this.remoteResource = options.remoteResource;
                if (options.remoteResourceId)       this.remoteResourceId = options.remoteResourceId;
                if (options.filter)                 this.filter = options.filter;
                if (options.selection)              this.selection = options.selection;
                if (type.number(options.offset))    this.offset = options.offset;
                if (type.number(options.limit))     this.limit = options.limit;
                if (options.order)                  this.order = options.order;
                if (options.relationalSelection)    this.relationalSelection = options.relationalSelection;
                if (options.data)                   this.data = options.data;
            }

            if (this.relationalSelection && this.relationalSelection.rootSelection) this.relationalSelection = this.relationalSelection.rootSelection;
        }




        hasFilter() {
            return !!this.filter;
        }


        getFilter() {
            return this.filter;
        }


        setFilter(filter) {
            this.filter = filter;
        }



        hasSelection(name) {
            return this.selection.indexOf(name) >= 0;
        }

        removeSelection(name) {
            this.selection.some((key, index) => {
                if (key === name) {
                    this.selection.splice(index, 1);
                    return true;
                }
            });
        }

        addSelection(...fields) {
            if (fields.length) {
                if (!this.selection) this.selection = [];
                if (type.array(fields[0])) this.selection = this.selection.concat(fields[0]);
                else this.selection = this.selection.concat(fields);
            }
        }





        hasRelationalSelection(name) {
            if (name) return this.relationalSelection && this.relationalSelection.has(name);
            return !!this.relationalSelection;
        }


        removeRelationalSelection(name) {
            if (this.hasRelationalSelection(name)) return this.relationalSelection.delete(name);
        }



        getRelationalSelection() {
            return this.relationalSelection;
        }


        addRelationalSelection(selection) {
            if (!this.relationalSelection) this.relationalSelection = new Map();
            this.relationalSelection.set(selection.resource, selection);
        }




        createResponse() {
            return new RelationalResponse();
        }
    }
})();
