{
    'use strict';

    const HeaderParser = require('./HeaderParser');




    module.exports = class SelectHeaderParser extends HeaderParser {



        constructor(options) {
            super(options);

            this.parser = options.parser;
        }





        getHeaderName() {
            return 'select';
        }



        /**
        * parses the authrization tokens
        * 
        * @param {array} headers an array containing header obejcts
        * @returns {array} array containing the accepted formats, 
        *   ordered by priority
        */
        async parse(headerValues) {
            const headerValue = headerValues.join(',');

            // get the raw data from the parser
            const parsedData = await this.parser.parse({
                selector: headerValue,
            });


            // the basic data structure that will be returned
            const selectionTree = {
                children: new Map(),
                properties: new Set(),
            };


            // transform the selection from parser output to 
            // relational request input
            if (parsedData.selector && parsedData.selector.children && parsedData.selector.children.length) {

                // merge the trees gotten from the 
                // header parser
                return this.compactSelection({
                    parserSelection: parsedData.selector.children,
                    parentSelection: selectionTree
                });
            }



            return selectionTree;
        }








        /**
        * the parser returns the output as an array of
        * trees that may contain the same path. this
        * method compacts the input into one tree.
        */
        compactSelection({
            parserSelection,
            parentSelection,
        }) {

            // iterate over all parsed nodes, group them per entity
            // in the subSelections map
            parserSelection.forEach((node) => {
                if (node.type === 'entity') {
                    if (!parentSelection.children.has(node.entityName)) {
                        parentSelection.children.set(node.entityName, {
                            children: new Map(),
                            name: node.entityName,
                            properties: new Set(),
                        });
                    }

                    if (node.children.length) {
                        this.compactSelection({
                            parserSelection: node.children,
                            parentSelection: parentSelection.children.get(node.entityName),
                        });
                    }
                } else if (node.type === 'property') {
                    parentSelection.properties.add(node.propertyName);
                } else {
                    throw new Error(`Invalid selection node type ${node.type}!`);
                }
            });

            return parentSelection;
        }
    }
}