(function() {
    'use strict';



    const Server    = require('./Server');
    const Service   = require('./Service');
    const type      = require('ee-types');
    const log       = require('ee-log');







    module.exports = class Website extends Service {

        constructor(options) {
            if (!type.object(options)) throw new Error(`The Website is missing the options object!`);
            if (!options.name) options.name = 'website';
            super(options);

            this.port = options.port || 80;


            // headers are beeing parsed and cached
            // in separate child processes
            this.threadCount = options.threadCount || 3;
            this.threads = [];


            // create the express erver
            this.server = new Server({
                port: this.port
            });


            // multithread header parser
            this.parser = new Parser();


            // register this as middleware on the server
            this.addRouter();
        }





        /**
         * express middleware
         */
        route(req, res) {
            let filter, select, order;


            this.parser.parse({
                  filter    : req.headers.filter
                , selector  : req.headers.select
                , order     : req.headers.order
            }).then((data) => {
                res.send(data);
            }).catch((err) => {
                if (err.message.startsWith('Failed to parse')) {

                    // header parser problems
                    res.status(400).send({
                          status: 'badRequest'
                        , code: 'parser_error'
                        , message: err.message
                    });
                } else {

                    // go for server errors
                    res.status(500).send({
                          status: 'serverError'
                        , code: 'handler_error'
                        , message: err.message
                    });
                }
            });
        }





        /**
         * return the express middleware
         */
        express() {
            return this.route.bind(this);
        }






        addRouter() {
            this.server.use(this);
        }







        executeLoad() {
            return this.server.listen().then(() => {
                return super.executeLoad();
            });
        }
    };
})();
