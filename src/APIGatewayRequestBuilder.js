{
    'use strict';


    const SelectionBuilder  = require('./SelectionBuilder');
    const RelationalRequest = require('./RelationalRequest');






    module.exports = class APIGatewayRequestBuilder {



        /**
        * creates a related request from the parser output
        */
        createRequest({
            parserOutput, 
            expressRequest,
            expressResponse,
        }) {
            // get the request url configuration
            const config = this.parseURL(expressRequest.url);


            const selection = new SelectionBuilder();


            // transform the selection from parser output to 
            // relational request input
            if (parserOutput.selector && parserOutput.selector.children && parserOutput.selector.children.length) {
                const rootSelection = {
                    children: new Map(),
                    properties: new Set(),
                };

                // merge the trees gotten from the 
                // header parser
                const selectionTree = this.compactSelection({
                    parserSelection: parserOutput.selector.children,
                    parentSelection: rootSelection
                });



                // select the root fields
                selection.setSelection(Array.from(rootSelection.properties.values()));



                // now create the actual selection
                // representation using the SelectionBuilder
                this.buildSelection({selection, selectionTree, serviceName});
            }



            // the filters should be in the correct format already!
            // so lets create the relational request
            const request = new RelationalRequest({
                relationalSelection: selection,
                filter: parserOutput.filter,

            });

        }







        








        /**
        * extracts the service, resource, resourceId
        * remoteService, remoteResource, remoteREsourceId
        * from the requests path part
        */
        parseURL(URLPath) {
            // so, lets see what the valid path patterns are:
            // /remoteService.remoteResource/remoteResourceId/service.resource/resourceId
            // /remoteService.remoteResource/remoteResourceId/service.resource
            // /service.resource/resourceId
            // /service.resource

            // this shoudl catch all variants
            const match = /^(?:\/([^\.\/\n]+)\.([^\/\n]+)\/([^\/\n]+))?\/([^\.\/\n]+)\.([^\/\n]+)(?:\/([^\/\n]+))?$/ig.exec(URLPath);

            if (match) {
                return {
                    remoteService: match[1],
                    remoteResource: match[2],
                    remoteResourceId: match[3],
                    service: match[4],
                    resource: match[5],
                    resourceId: match[6],
                };
            } else return null;
        }









        /**
        * create a relational selection from the selection
        * tree we just built using the compactSelection 
        * method.
        */
        buildSelection({
            selection, 
            selectionTree,
            serviceName,
        }) {
            for (const [name, child] of selectionTree.children.entries()) {
                const childSelection = selection.select(serviceName, child.name, Array.from(child.properties.values()));

                this.buildSelection({
                    selection: childSelection,
                    selectionTree: child,
                    serviceName: serviceName
                });
            }
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
                    if (!parentSelection.has(node.entityName)) {
                        parentSelection.set(node.entityName, {
                            children: new Map(),
                            name: node.entityName,
                            properties: new Set(),
                        });
                    }

                    if (node.children.length) {
                        this.compactSelection({
                            parserSelection: node.children,
                            parentSelection: parentSelection.get(node.entityName),
                        });
                    }
                } else if (node.type === 'property') {
                    parentSelection.properties.add(node.propertyName);
                } else {
                    throw new Error(`Invalid selection node type ${node.type}!`);
                }
            });
        }
    }
}