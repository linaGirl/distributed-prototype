(function() {
    'use strict';

    const log = require('ee-log');


    module.exports = class RelationalSelection {


        constructor(options) {
            if (options) {
                if (options.selection) this.addSelection(options.selection);
                this.filter = options.filter;
                this.resource = options.resource;
                this.service = options.service;
                this.tokens = options.tokens;
            }

            this.children = [];
        }




        hasFilter() {
            return !!this.filter;
        }

        removeFilter() {
            this.filter = null;
            return this;
        }








        hasSelection() {
            return this.selection && this.selection.length;
        }

        addSelection(item) {
            if (!this.selection) this.selection = [];
            if (Array.isArray(item)) item.forEach(i => this.selection.push(i));
            else this.selection.push(item);
        }

        getSelection() {
            return this.selection || [];
        }









        addToken(token) {
            if (!this.tokens) this.tokens = [];
            if (Array.isArray(token)) token.forEach(t => this.tokens.push(t));
            else this.tokens.push(token);
        }






        addSubSelection(selection) {
            this.children.push(selection);
            return this;
        }

        addSubSelections(selections) {
            selections.forEach(s => this.children.push(s));
            return this;
        }


        hasRelationalSelection(name) {
            for (const selection of this.children) {
                if (selection.resource === name) return true;
            }
            return false;
        }


        getRelationalSelection(name) {
            for (const selection of this.children) {
                if (selection.resource === name) return selection;
            }
        }

        getSubselectionMap() {
            const map = new Map();
            this.children.forEach(k => map.set(k.resource, k));
            return map;
        }
    };
})();