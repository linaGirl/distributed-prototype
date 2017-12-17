{
    'use strict';


    const RequestProcessor = require('./RequestProcessor');
    const RelationalRequest = require('../RelationalRequest');
    const log = require('ee-log');
    const type = require('ee-types');


    const AcceptHeaderParser = require('./headerParser/Accept');
    const AcceptLanguageHeader = require('./headerParser/AcceptLanguage');
    const AuthorizationHeaderParser = require('./headerParser/Authorization');






    module.exports = class PostRequestProcessor extends RequestProcessor {


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
        }






        /**
        * handles all required steps to process 
        * an incoming POST request
        */
        async processRequest({
            httpRequest, 
            httpResponse,
            requestId,
        }) {
            
            // get the basic request configuration
            const urlParts = await this.parseURL(httpRequest);

            // get the parsed headers
            const headers = await this.parseHeaders(httpRequest);

            
            const distributedRequest = new RelationalRequest({
                service: urlParts.service,
                resource: urlParts.resource,
                resourceId: urlParts.resourceId,
                remoteService: urlParts.remoteService,
                remoteResource: urlParts.remoteResource,
                remoteResourceId: urlParts.remoteResourceId,
                tokens: headers.has('authorization') ? headers.get('authorization').map(token => token.token) : [],
                action: this.getActionName(urlParts, httpRequest.body),
                data: httpRequest.body
            });

            return distributedRequest;
        }




        /**
        * define the action that the request has 
        */
        getActionName(urlParts, body) {
            const one = !type.array(body);

            if (urlParts.remoteResource) return `create${one ? 'One' : ''}Relation`;
            else return `create${one ? 'One' : ''}`;
        }
    }
}