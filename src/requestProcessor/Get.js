{
    'use strict';

    const log = require('ee-log');
    const RequestProcessor = require('./RequestProcessor');
    const RelationalRequest = require('../RelationalRequest');
    const SelectionBuilder = require('../SelectionBuilder');


    const AcceptHeaderParser = require('./headerParser/Accept');
    const AcceptLanguageHeader = require('./headerParser/AcceptLanguage');
    const AuthorizationHeaderParser = require('./headerParser/Authorization');
    const FilterHeaderParser = require('./headerParser/Filter');
    const SelectHeaderParser = require('./headerParser/Select');




    module.exports = class GetRequestProcessor extends RequestProcessor {



        constructor(options) {
            super(options);


            // accept header
            this.registerHeaderParser(new AcceptHeaderParser({
                required: true
            }));

            // accept language heaader
            this.registerHeaderParser(new AcceptLanguageHeader({
                required: true
            }));

            // authorization header parser
            this.registerHeaderParser(new AuthorizationHeaderParser());

            // filter header parser
            this.registerHeaderParser(new FilterHeaderParser({
                parser: this.parser
            }));

            // select header parsser
            this.registerHeaderParser(new SelectHeaderParser({
                parser: this.parser
            }));
        }





        /**
        * handles all required steps to process 
        * an incoming GET request
        */
        async processRequest({
            request, 
            response,
            action,
        }) {
            
            // get the basic request configuration
            const urlParts = await this.parseURL(request);

            // get the parsed headers
            const headers = await this.parseHeaders(request);


            // it's time to create the selection
            const selection = new SelectionBuilder();
            this.buildSelection({
                selection: selection,
                selectionTree: headers.get('select'),
                serviceName: urlParts.service,
            });

            
            const distributedRequest = new RelationalRequest({
                relationalSelection: selection.selection,
                selection: selection.properties,
                service: urlParts.service,
                resource: urlParts.resource,
                resourceId: urlParts.resourceId,
                remoteService: urlParts.remoteService,
                remoteResource: urlParts.remoteResource,
                remoteResourceId: urlParts.remoteResourceId,
                filter: headers.get('filter'),
                tokens: headers.get('authorization'),
                action: action,
            });


            log({urlParts, headers});
            log(distributedRequest);
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





    }
}