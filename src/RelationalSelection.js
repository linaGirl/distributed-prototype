(function() {
    'use strict';




    module.exports = class RelationalSelection {


        constructor(options) {
            if (options) {
                this.selection = options.selection;
                this.filter = options.filter;
                this.resource = options.resource;
            }

            this.children = [];
        }




        hasFilter() {
            return !!this.filter;
        }




        addSubSelections(selections) {
            selections.forEach(s => this.children.push(s));
        }




        getSubselectionMap() {
            const map = new Map();
            this.children.forEach(k => map.set(k.resource, k));
            return map;
        }
    };
})();