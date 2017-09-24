{
    'use strict';

    const HeaderParser = require('./HeaderParser');




    module.exports = class AcceptLanguageHeaderParser extends HeaderParser {



        getHeaderName() {
            return 'accept-language';
        }



        /**
        * parses the accepted languages
        * 
        * @param {array} headers an array containing header obejcts
        * @returns {array} array containing the accepted formats, 
        *   ordered by priority
        */
        async parse(headerValues) {
            const acceptLanguageList = [].concat(...headerValues.map(value => this.parseRFCHeader(value))).sort((a, b,) => b.priority - a.priority);

            if (this.required && !acceptLanguageList.length) {
                throw new Error({
                    status: 400,
                    code: 'invalid_accept_language_header',
                    message: `Invalid or missing accept language header. Please supply at least one language and use the format specified by the RFC`,
                });
            }

            // create an array from all header values
            // order it by priority
            return acceptLanguageList;
        }
    }
}