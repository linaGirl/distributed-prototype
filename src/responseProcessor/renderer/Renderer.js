{
    'use strict';


    const assert = require('assert');




    module.exports = class ResponseRenderer {
        


        constructor() {

            // this map holds the information
            // about types that can be rendered
            this.types = new Map();

            // the score is used to decide which renderer
            // shall be used to render a specific type.
            // the base score is given to each renderer
            // in order to specify how specific it is.
            // for example, a renderer for the 'application'
            // type and a '*' subtype should have a very
            // low score since it probably is a very
            // bad renderer.
            this.score = 100;

            // a simple translation table between distributed
            // status codes and HTTP status codes
            this.statusTable = new Map([
                ['ok', 200],
                ['error', 500],
                ['notFound', 404],
                ['conflict', 409],
                ['invalidAction', 501],
                ['badRequest', 400],
                ['serviceUnavailable', 503],
                ['forbidden', 403],
                ['tooManyRequests', 429],
                ['authorizationRequired', 401],
                ['created', 201],
                ['noContent', 204],
                ['accepted', 202],
                ['seeOther', 303],
            ]);
        }







        /**
        * translates distributed status codes 
        * to HTTP status codes
        */
        getHTTPStatus(distributedStatus) {
            if (this.statusTable.has(distributedStatus)) return this.statusTable.get(distributedStatus);
            else {
                throw {
                    status: 500,
                    code: 'invalid_response',
                    description: `Unknown status '${distributedStatus}', cannot handle response!`,
                };
            }
        }








        /**
        * this method needs to be implemented by the renderer itself
        */
        async render({
            request, 
            response, 
            distributedRequest,
            distributedResponse,
        }) {
            throw new Error(`The renderer ${this.constructor.name} has not implemented the 'render' method!`);
        }







        /**
        * register a new type that this
        * renderer can handle. use * for 
        * wildcards
        */
        registerType(type, subType, score) {
            assert(typeof type === 'string', `Cannot register rederer type: expected a string for the type argument!`);
            assert(typeof subType === 'string', `Cannot register rederer type: expected a string for the subType argument!`);

            if (!this.types.has(type)) this.types.set(type, new Map());
            this.types.get(type).set(subType, score);
        }







        /**
        * computes the score this renderer has for a specific
        * type of data that needs to be rendered.
        * 
        * @param {string} type the type to render
        * @param {string} subType the subType to render
        * @returns {boolean} true if it is able to render the type
        */
        getScore(type, subType) {
            if (this.types.has(type)) {
                if (this.types.get(type).has(subType)) return this.types.get(type).get(subType);
                else if (this.types.get(type).has('*')) return Math.round(this.types.get(type).get('*')/2);
            }

            return 0;
        }
    }
}