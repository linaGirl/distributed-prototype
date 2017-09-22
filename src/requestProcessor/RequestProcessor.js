{
    'use strict';

    const SelectionBuilder  = require('../SelectionBuilder');
    const log = require('ee-log');




    module.exports = class RequestProcessor {



        constructor({
            parser
        }) {
            this.parser = parser;
        }





        /**
        * get basic info from the request that
        * is common to all requests
        */
        async getRequestConfiguration(request) {
            const config = await this.parseURL(request.url);

            // extract authorization tokens
            config.authorizationTokens = await this.getAuthorizationTokens(request);

            return config;
        }









        /**
        * extract authorization tokens
        */
        async getAuthorizationTokens(request) {
            const headers = request.rawHeaders;
            const tokens = [];

            // express, this is sad :/ headers are stored
            // in an array, alternating between name 
            // and value.
            for (let i = 0, l = headers.length; i < l; i+=2) {
                // making sure not to process headers 
                // with too long contents
                if (headers[i].length < 20 && headers[i].trim().toLowerCase() === 'authorization') {
                    if (headers[i+1].length < 100) {
                        const match = /^([a-z0-9_-]+) ([a-z0-9_-]+)$/gi.exec(headers[i+1].trim());

                        if (match) {
                            tokens.push({
                                type: match[1].toLowerCase(),
                                token: match[2]
                            });
                        } else {
                            throw {
                                status: 400,
                                code: 'invalid_authorization_header',
                                message: `Invalid authorization header. Header format 'Authorization:type token' (/authorization:[a-z0-9_-]+ [a-z0-9_-]+/i)`,
                            };
                        }
                    }
                }
            }

            return tokens;
        }







        /**
        * get the parsed select header from the request
        */
        async parseSelection({
            request,
            requestConfiguration,
        }) {
            const parsedData = await this.parser.parse({
                selector: request.headers.select,
            });


            const selection = new SelectionBuilder();
            let selectedProperties;


            // transform the selection from parser output to 
            // relational request input
            if (parsedData.selector && parsedData.selector.children && parsedData.selector.children.length) {

                // merge the trees gotten from the 
                // header parser
                const selectionTree = this.compactSelection({
                    parserSelection: parsedData.selector.children,
                    parentSelection: {
                        children: new Map(),
                        properties: new Set(),
                    }
                });


                // need to return them separately
                selectedProperties = Array.from(selectionTree.properties.values());


                // now create the actual selection
                // representation using the SelectionBuilder
                this.buildSelection({
                    selection: selection, 
                    selectionTree: selectionTree, 
                    serviceName: requestConfiguration.serviceName
                });
            }



            return {
                selection: selection,
                properties: selectedProperties
            };
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
        * get the parsed filter header from the request
        */
        async parseFilter(request) {
            const parsedData = await this.parser.parse({
                filter: request.headers.filter,
            });


            return parsedData && parsedData.filter;
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







        /**
        * extracts the service, resource, resourceId
        * remoteService, remoteResource, remoteREsourceId
        * from the requests path part
        */
        async parseURL(URLPath) {
            // so, lets see what the valid path patterns are:
            // /remoteService.remoteResource/remoteResourceId/service.resource/resourceId
            // /remoteService.remoteResource/remoteResourceId/service.resource
            // /service.resource/resourceId
            // /service.resource

            // this shoudl catch all variants
            const match = /^(?:\/([^\.\/\n]+)\.([^\/\n]+)\/([^\/\n]+))?\/([^\.\/\n]+)\.([^\/\n]+)(?:\/([^\/\n]+))?$/ig.exec(URLPath);

            if (match) {
                return {
                    remoteService: match[1] ? match[1] : null,
                    remoteResource: match[2] ? match[2] : null,
                    remoteResourceId: match[3] ? match[3] : null,
                    service: match[4] ? match[4] : null,
                    resource: match[5] ? match[5] : null,
                    resourceId: match[6] ? match[6] : null,
                };
            } else return null;
        }
    }
}