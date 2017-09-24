{
    'use strict';



    module.exports = class HeaderParser {
        


        constructor({
            required = false,
        } = {}) {
            this.required = required;
        }



        /**
        * splits a header into singe parts, trims them
        */
        parseRFCHeader(header) {
            return (header || '')
                .split(',')
                .map(part => part.trim())
                .filter(part => !!part)
                .map((part) => {
                    const match = /^([^;\n]+);\s*q\s*=\s*([0-9\.]+)$/gi.exec(part);

                    if (match) {
                        return {
                            priority: parseFloat(match[2]),
                            value: match[1],
                        };
                    } else {
                        return {
                            priority: 1.0,
                            value: part,
                        };
                    }
                }).sort((a, b) => {
                    return b.priority - a.priority;
                });
        }
    }
}