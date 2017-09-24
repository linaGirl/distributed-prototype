{
    'use strict';

    const HeaderParser = require('./HeaderParser');




    module.exports = class FilterHeaderParser extends HeaderParser {





        constructor(options) {
            super(options);

            this.parser = options.parser;
        }





        getHeaderName() {
            return 'filter';
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

            const parsedData = await this.parser.parse({
                filter: headerValue,
            });


            return parsedData && parsedData.filter;
        }
    }
}