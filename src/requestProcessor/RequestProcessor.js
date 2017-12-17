{
    'use strict';

    const SelectionBuilder  = require('../SelectionBuilder');
    const log = require('ee-log');




    module.exports = class RequestProcessor {



        constructor({
            parser
        }) {
            // the slect & filter header infrastructure
            // it's passed into this class beause it uses 
            // a shitload of resources.
            this.parser = parser;

            // the headers get parsed by header specific
            // parser classes. they can be registered using
            // the registerHeaderParser method. all headers 
            // that are registered here will be applied to 
            // each request.
            this.headerParsers = new Map();
        }





        /**
        * register a new headerParser on the class
        */
        registerHeaderParser(parser) {
            const headerName = parser.getHeaderName();

            // one cannot overwrite existing parsers, that's
            // likely an user error
            if (this.headerParsers.has(headerName)) {
                throw new Error(`Cannot register parser for header ${headerName}, there is already a parser registered for that header!`);
            } else {
                this.headerParsers.set(headerName, parser);
            }
        }







        /**
        * parse all headers using the availabe parsers
        */
        async parseHeaders(request) {
            
            // get a clean array of headers
            const headers = this.normalizeHeaders(request);

            // remove headers we're not processing, let the
            // processor only process its only header values
            for (const [headerName, headerValues] of headers.entries()) {

                // get the right parser
                const parser = this.headerParsers.get(headerName);

                // get the values async
                const headerValue = await parser.parse(headerValues);
                

                // replace the raw header values with the parsed values
                headers.set(headerName, headerValue);
            }

            return headers;
        }






        /**
        * return a usable set of headers, which is nothing
        * express.js is givin us for free :/
        */
        normalizeHeaders(request) {
            const headers = request.rawHeaders;
            const normalizedHeaders = new Map();

            // express, this is sad :/ headers are stored
            // in an array, alternating between name 
            // and value.
            for (let i = 0, l = headers.length; i < l; i+=2) {
                const headerName = headers[i].trim().toLowerCase();

                // onyl returning header we have parsers for
                if (this.headerParsers.has(headerName)) {
                    if (!normalizedHeaders.has(headerName)) normalizedHeaders.set(headerName, []);
                    normalizedHeaders.get(headerName).push(headers[i+1]);
                }
            }

            return normalizedHeaders;
        }







        /**
        * define the action that the request has 
        */
        getActionName(urlParts, prefix) {
            if (urlParts.remoteResourceId !== null && urlParts.remoteResourceId !== undefined) return `${prefix}OneRelation`;
            else if (urlParts.remoteResource) return `${prefix}Relation`;
            else if (urlParts.resourceId !== null && urlParts.remoteResource !== undefined) return `${prefix}One`;
            else return `${prefix}`;
        }








        /**
        * extracts the service, resource, resourceId
        * remoteService, remoteResource, remoteREsourceId
        * from the requests path part
        */
        async parseURL(request) {
            // so, lets see what the valid path patterns are:
            // /remoteService.remoteResource/remoteResourceId/service.resource/resourceId
            // /remoteService.remoteResource/remoteResourceId/service.resource
            // /service.resource/resourceId
            // /service.resource

            // this shoudl catch all variants
            const match = /^(?:\/([^\.\/\n]+)\.([^\/\n]+)\/([^\/\n]+))?\/([^\.\/\n]+)\.([^\/\n]+)(?:\/([^\/\n]+))?$/ig.exec(request.url);

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