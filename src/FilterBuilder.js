(function() {
    'use strict';



    const log = require('ee-log');



    module.exports = class FilterBuilder {


        constructor(parent, type) {
            this.type = type || 'root';
            this.children = [];
            this.parent = parent;
        }




        and() {
            const builder = new FilterBuilder(this, 'and');
            this.addChild(builder);
            return builder;
        }

        or() {
            const builder = new FilterBuilder(this, 'or');
            this.addChild(builder);
            return builder;
        }

        getFirstNonEntityParentChild(scope) {
            if (scope.parent.type === 'entity') return this.getFirstNonEntityParentChild(scope.parent);
            else return scope;
        }





        comparator(comparator) {
            const builder = new FilterBuilder(this, 'comparator').setComparator(comparator);
            this.addChild(builder);
            return builder;
        }

        setComparator(comparator) {
            if (this.type !== 'comparator') throw new Error(`Cannot set comparator on node of the type ${this.type}!`);
            this.comparator = comparator;
            return this;
        }





        fn(functionName, parameters) {
            const builder = new FilterBuilder(this, 'function').setFunctionName(functionName).setParameters(parameters);
            this.addChild(builder);
            return builder;
        }

        setFunctionName(functionName) {
            if (this.type !== 'function') throw new Error(`Cannot set function on node of the type ${this.type}!`);
            this.functionName = functionName;
            return this;
        }

        setParameters(parameters) {
            if (this.type !== 'function') throw new Error(`Cannot set parameters on node of the type ${this.type}!`);
            this.parameters = parameters;
            return this;
        }





        entity(name) {
            const builder = new FilterBuilder(this, 'entity').setEntityName(name);
            this.addChild(builder);
            return builder;
        }

        setEntityName(name) {
            if (this.type !== 'entity') throw new Error(`Cannot set entity on node of the type ${this.type}!`);
            this.entityName = name;
            return this;
        }




        property(name) {
            const builder = new FilterBuilder(this, 'property').setPropertyName(name);
            this.addChild(builder);
            return builder;
        }

        setPropertyName(name) {
            if (this.type !== 'property') throw new Error(`Cannot set property on node of the type ${this.type}!`);
            this.propertyName = name;
            return this;
        }





        value(value) {
            this.addChild(new FilterBuilder(this, 'value').setValue(value));
            return this;
        }

        setValue(value) {
            if (this.type !== 'value') throw new Error(`Cannot set value on node of the type ${this.type}!`);
            this.nodeValue = value;
            return this;
        }




        addChild(child) {
            if (child) this.children.push(child);
            return this;
        }
    };
})();
