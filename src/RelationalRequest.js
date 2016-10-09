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
                if (options.offset)                 this.offset = options.offset;
                if (options.limit)                  this.limit = options.limit;
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





        hasRelationalSelection() {
            return !!this.relationalSelection;
        }




        getRelationalSelection() {
            return this.relationalSelection;
        }




        createResponse() {
            return new RelationalResponse();
        }
    }
})();
