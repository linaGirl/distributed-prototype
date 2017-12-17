(function() {
    'use strict';


    const express = require('express');
    const type = require('ee-types');
    const log = require('ee-log');
    const multiparty = require('multiparty');
    const bodyparser = require('body-parser');




    module.exports = class {

        constructor(options) {
            if (!type.object(options)) throw new Error(`The server is missing the options object!`);

            this.port = options.port || 80;
            this.app = express();

            // body parsers
            this.app.use(bodyparser.json());
            this.app.use(bodyparser.urlencoded({
                extended: true
            }));


            this.app.use(this.handleMultipartUpload.bind(this));
        }





        /**
        * a makeshift multipart parsing infrastructure
        */
        handleMultipartUpload(request, response, next) {

            // the parsers are lame ... so.. yeah
            // assume required data structures
            if (request.method !== 'get' && /multipart\/form-data/i.test(request.headers['content-type'])) {
                const form = new multiparty.Form();
                form.parse(request, (err, fields, files) => {
                    if (err) {
                        response
                            .status(500)
                            .type('application/json')
                            .send({
                                status: 500,
                                code: 'parser_error',
                                description: `Failed to parse body: ${err.message}`,
                            });
                    } else {
                        const body = {};
                        const fileSet = new Set();

                        // what the fuck is this data structure?
                        if (type.object(fields)) {
                            Object.keys(fields).forEach((name) => {
                                if (fields[name].length) {
                                    const value = fields[name][0];
                                    if (!/[^0-9]/i.test(value)) body[name] = parseInt(value, 10);
                                    else if (!/[^0-9\.]/i.test(value)) body[name] = parseFloat(value);
                                    else if (/true|false/i.test(value)) body[name] = Boolean(value);
                                    else if (value === '') body[name] = null
                                    else body[name] = value;
                                }
                            });
                        }

                        if (type.object(files)) {
                            Object.keys(files).forEach((name) => {
                                if (files[name].length) {
                                    fileSet.add(...files[name]);
                                }
                            });
                        }

                        request.body = body;
                        if (fileSet.size) request.body.files = Array.from(fileSet);
                        next();
                    }
                });
            } else next();
        }






        /**
         * add distributed middlewares
         */
        use(distributedMiddleware) {
            if (type.object(distributedMiddleware) && type.function(distributedMiddleware.express)) {
                distributedMiddleware.express(this.app);
            } else throw new Error(`Cannot add middleware, it has to be a distributed middleware exposing the 'express' method!`);
        }





        /**
         * start http server
         */
        listen() {
            return new Promise((resolve, reject) => {
                this.app.listen(this.port, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    };
})();
