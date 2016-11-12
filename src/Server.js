(function() {
    'use strict';


    const express = require('express');
    const type = require('ee-types');
    const log = require('ee-log');



    module.exports = class {

        constructor(options) {
            if (!type.object(options)) throw new Error(`The server is missing the options object!`);

            this.port = options.port || 80;
            this.app = express();
        }




        /**
         * add distributed middlewares
         */
        use(distributedMiddleware) {
            if (type.object(distributedMiddleware) && type.function(distributedMiddleware.express)) {
                const expressMiddleware = distributedMiddleware.express(this.app);

                // add to the app
                if (expressMiddleware) this.app.use(expressMiddleware);
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
