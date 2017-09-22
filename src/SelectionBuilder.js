(function() {
    'use strict';



    const log = require('ee-log');
    const RelationalSelection = require('./RelationalSelection');




    module.exports = class SelectionBuilder {


        constructor(parent) {
            if (!parent) {
                this.children = new Map();
            } else {
                this.selection = new RelationalSelection();
                this.parent = parent;
            }
        }


        filter(filter) {
            this.selection.filter = filter;
        }



        select(serviceName, resourceName, ...selection) {
            const builder = new SelectionBuilder(this);
            builder.setResource(resourceName);
            builder.setService(serviceName);
            builder.setSelection(selection.length === 1 && Array.isArray(selection[0]) ? selection[0] : selection);

            if (this.children) this.children.set(resourceName, builder.selection);
            else this.selection.children.push(builder.selection);

            builder.service = serviceName;

            return builder;
        }


        setService(serviceName) {
            this.selection.service = serviceName;
        }



        setResource(resourceName) {
            this.selection.resource = resourceName;
        }




        setSelection(selection) {
            this.selection.selection = selection;
            this.selectionSet = true;
        }



        up() {
            if (this.parent) return this.parent;
            else throw new Error('Cannot go up, the current selection has no parent!');
        }




        get root() {
            if (this.parent) return this.parent.root;
            else return this;
        }


        get rootSelection() {
            return this.root.children;
        }
    };
})();
