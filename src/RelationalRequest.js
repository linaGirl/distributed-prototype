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
                if (options.resourceId)                         this.setResourceId(options.resourceId);
                if (options.remoteService)                      this.setRemoteService(options.remoteService);
                if (options.remoteResource)                     this.setRemoteResource(options.remoteResource);
                if (!type.undefined(options.remoteResourceId))  this.setRemoteResourceId(options.remoteResourceId);
                if (options.filter)                             this.setFilter(options.filter);
                if (options.selection)                          this.addSelection(options.selection);
                if (type.number(options.offset))                this.setOffset(options.offset);
                if (type.number(options.limit))                 this.setLimit(options.limit);
                if (options.order)                              this.setOrder(options.order);
                if (options.relationalSelection)                this.setRelationalSelection(options.relationalSelection);
                if (options.data)                               this.setData(options.data);
                if (options.languages)                          this.setLanguages(options.languages);
            }
        }







        setOrder(order) {
            if (!type.array(order)) throw new Error(`Expecting an array when setting the order on the request, got ${type(order)} instead!`);
            this.order = order;
            return this;
        }

        getOrder() {
            return this.order || [];
        }

        hasOrder() {
            return this.order && this.order.length;
        }






        setLanguages(languages) {
            if (!type.array(languages)) throw new Error(`Expecting an array when setting the languages on the request, got ${type(languages)} instead!`);
            this.languages = languages;
            return this;
        }

        getLanguages() {
            return this.languages || [];
        }

        hasLanguages() {
            return this.languages && this.languages.length;
        }







        setData(data) {
            this.data = data;
            return this;
        }

        getData() {
            return this.data;
        }

        hasData() {
            return !type.undefined(this.data)
        }







        setLimit(limit) {
            if (!type.number(limit)) throw new Error(`Expecting a number when setting the limit on the request, got ${type(limit)} instead!`);
            if (limit < 0) throw new Error(`Expecting a positive number when setting the limit on the request!`);
            this.limit = limit;
            return this;
        }

        getLimit() {
            return this.hasLimit() ? this.limit : null;
        }

        hasLimit() {
            return type.number(this.limit);
        }







        setOffset(offset) {
            if (!type.number(offset)) throw new Error(`Expecting a number when setting the offset on the request, got ${type(offset)} instead!`);
            if (offset < 0) throw new Error(`Expecting a positive number when setting the offset on the request!`);
            this.offset = offset;
            return this;
        }

        getOffset() {
            return this.hasOffset() ? this.offset : null;
        }

        hasOffset() {
            return type.number(this.offset);
        }







        setRemoteResource(remoteResource) {
            if (!type.string(remoteResource)) throw new Error(`Expecting a string when setting the remoteResource on the request, got ${type(remoteResource)} instead!`);
            if (!remoteResource.length) throw new Error(`Expecting a non empty string when setting the remoteResource on the request!`);
            this.remoteResource = remoteResource;
            return this;
        }

        getRemoteResource() {
            return this.remoteResource || null;
        }

        hasRemoteResource() {
            return !!this.remoteResource;
        }







        setRemoteService(remoteService) {
            if (!type.string(remoteService)) throw new Error(`Expecting a string when setting the remoteService on the request, got ${type(remoteService)} instead!`);
            if (!remoteService.length) throw new Error(`Expecting a non empty string when setting the remoteService on the request!`);
            this.remoteService = remoteService;
            return this;
        }

        getRemoteService() {
            return this.remoteService || null;
        }

        hasRemoteService() {
            return !!this.remoteService;
        }








        setRemoteResourceId(remoteResourceId) {
            if (type.undefined(remoteResourceId)) throw new Error(`The remoteResourceId on a request cannot be undefined!`);
            this.remoteResourceId = remoteResourceId;
            return this;
        }

        getRemoteResourceId() {
            return this.hasResourceId() ? this.remoteResourceId : null;
        }

        hasRemoteResourceId() {
            return !type.undefined(this.remoteResourceId);
        }









        setResourceId(resourceId) {
            if (type.undefined(resourceId)) throw new Error(`The resourceId on a request cannot be undefined!`);
            this.resourceId = resourceId;
            return this;
        }

        getResourceId() {
            return this.hasResourceId() ? this.resourceId : null;
        }

        hasResourceId() {
            return !type.undefined(this.resourceId);
        }











        hasFilter() {
            return !!this.filter;
        }

        getFilter() {
            return this.filter;
        }

        setFilter(filter) {
            this.filter = filter.root ? filter.root : filter;
            return this;
        }







        hasSelection(name) {
            return this.selection && this.selection.includes(name);
        }

        removeSelection(name) {
            if (!name) this.selection = [];
            else {
                this.selection.some((key, index) => {
                    if (key === name) {
                        this.selection.splice(index, 1);
                        return true;
                    }
                });
            }
        }

        addSelection(...fields) {
            if (fields.length) {
                if (!this.selection) this.selection = [];
                if (type.array(fields[0])) this.selection = this.selection.concat(fields[0]);
                else this.selection = this.selection.concat(fields);
            }
            return this;
        }


        getSelection() {
            return this.selection || [];
        }







        setRelationalSelection(relationalSelection) {
            this.relationalSelection = relationalSelection;
            if (this.relationalSelection && this.relationalSelection.rootSelection) this.relationalSelection = this.relationalSelection.rootSelection;
            return this;
        }

        hasRelationalSelection(name) {
            if (name) return this.relationalSelection && this.relationalSelection.has(name);
            return !!this.relationalSelection;
        }

        removeRelationalSelection(name) {
            if (name && this.hasRelationalSelection(name)) return this.relationalSelection.delete(name);
            else if (!name) delete this.relationalSelection;
        }

        getRelationalSelection(name) {
            if (name) return this.relationalSelection.get(name);
            return this.relationalSelection;
        }

        addRelationalSelection(selection) {
            if (!this.relationalSelection) this.relationalSelection = new Map();
            this.relationalSelection.set(selection.resource, selection);
            return this;
        }





        validate() {
            super.validate();

            if (this.hasRemoteResourceId() && !this.hasRemoteResource()) throw new Error(`Missing the remoteResource on the Request when the remoteResourceId is set!`);
            if (this.hasRemoteResource() && !this.hasRemoteService()) throw new Error(`Missing the remoteService on the Request when the remoteResource is set!`);
        }





        createResponse() {
            return new RelationalResponse();
        }
    }
})();
