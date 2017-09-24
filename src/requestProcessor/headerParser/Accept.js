{
    'use strict';

    const HeaderParser = require('./HeaderParser');




    module.exports = class AcceptHeaderParser extends HeaderParser {



        getHeaderName() {
            return 'accept';
        }



        /**
        * parses the accept formats
        * 
        * @param {array} headers an array containing header obejcts
        * @returns {array} array containing the accepted formats, 
        *   ordered by priority
        */
        async parse(headerValues) {
            const acceptList = [].concat(...headerValues.map(value => this.parseRFCHeader(value))).sort((a, b,) => b.priority - a.priority);

            if (this.required && !acceptList.length) {
                throw new Error({
                    status: 400,
                    code: 'invalid_accept_header',
                    message: `Invalid or missing accept header. Please supply at least one format and use the format specified by the RFC`,
                });
            }

            // create an array from all header values
            // order it by priority
            return acceptList;
        }
    }
}