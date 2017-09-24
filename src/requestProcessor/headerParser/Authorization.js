{
    'use strict';

    const HeaderParser = require('./HeaderParser');




    module.exports = class AuthorizationHeaderParser extends HeaderParser {



        getHeaderName() {
            return 'authorization';
        }



        /**
        * parses the authrization tokens
        * 
        * @param {array} headers an array containing header obejcts
        * @returns {array} array containing the accepted formats, 
        *   ordered by priority
        */
        async parse(headerValues) {
            const tokens = headerValues.map((headerValue) => {
                const match = /^([a-z0-9_-]+) ([a-z0-9_-]+)$/gi.exec(headerValue);

                if (match) {
                    return {
                        type: match[1].toLowerCase(),
                        token: match[2]
                    };
                } else {
                    throw {
                        status: 400,
                        code: 'invalid_authorization_header',
                        message: `Invalid authorization header. Header format 'Authorization:type token' (/authorization:[a-z0-9_-]+ [a-z0-9_-]+/i)`,
                    };
                }
            });


            if (this.required && !tokens.length) {
                throw new Error({
                    status: 400,
                    code: 'missing_authorization_header',
                    message: `Missing authorization header. Please supply at least one authorization header. Header format 'Authorization:type token' (/authorization:[a-z0-9_-]+ [a-z0-9_-]+/i`,
                });
            }

            // get all accept headers instances
            return tokens;
        }
    }
}