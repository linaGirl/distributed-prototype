(function() {
    'use strict';



    const Server            = require('./Server');
    const Service           = require('./Service');
    const type              = require('ee-types');
    const log               = require('ee-log');
    const Parser            = require('./APIGatewayParser');
    const RequestBuilder    = require('./APIGatewayRequestBuilder');
    const crypto            = require('crypto');



    const DeleteRequestProcessor = require('./requestProcessor/Delete');
    const GetRequestProcessor = require('./requestProcessor/Get');
    const HeadRequestProcessor = require('./requestProcessor/Head');
    const OptionsRequestProcessor = require('./requestProcessor/Options');
    const PatchRequestProcessor = require('./requestProcessor/Patch');
    const PostRequestProcessor = require('./requestProcessor/Post');
    const PutRequestProcessor = require('./requestProcessor/Put');





    module.exports = class APIGatewayService extends Service {

        constructor(options) {
            if (!type.object(options)) throw new Error(`The APIGatewayService is missing the options object!`);
            if (!options.name) options.name = 'api-gateway';
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


            // request builder: takes the output of the
            // parser and creates requests from it
            this.requestBuilder = new RequestBuilder();


            // multithread header parser
            this.parser = new Parser();



            // load the different request processors
            this.processors = new Map([
                ['delete', new DeleteRequestProcessor({parser: this.parser})],
                ['get', new GetRequestProcessor({parser: this.parser})],
                ['head', new HeadRequestProcessor({parser: this.parser})],
                ['options', new OptionsRequestProcessor({parser: this.parser})],
                ['patch', new PatchRequestProcessor({parser: this.parser})],
                ['post', new PostRequestProcessor({parser: this.parser})],
                ['put', new PutRequestProcessor({parser: this.parser})],
            ]);




            // register this as middleware on the server
            this.addRouter();
        }





        /**
         * express middleware
         */
        route(request, response) {
            const action = request.method.toLowerCase();
            const requestId = this.createRandomId();


            if (this.processors.has(action)) {

                // let specialized classes do the work
                this.processors.get(action).processRequest({
                    request, 
                    response,
                    requestId,
                    action,
                }).then((distributedRequest) => {

                    
                }).catch((err) => {
                    if (err instanceof Error) {
                        
                        // log info, this should never happen
                        log.warn(`Uncaught error for request ${requestId}`, {
                            method: action,
                            requestId: requestId,
                            url: request.url,
                            rawHeaders: request.rawHeaders,
                        });
                        
                        log(err);
                        
                        // don't tell the client any details
                        response.status(500).send({
                            status: 500,
                            code: 'server_error',
                            description: `The server encountered an error while processing the request. Request-id: ${requestId}`
                        });
                    } else if (type.object(err) && err.status && err.code) {

                        // custom parser error
                        response.status(err.status).send({
                            status: err.status,
                            code: err.code,
                            description: err.description
                        });
                    }
                });
            } else {
                response.status(405).send({
                    status: 405,
                    code: 'method_not_allowed',
                    description: `The ${action} is not supported by this server`
                });
            }
        }





        /**
        * create a random request id for the error reporter
        */
        createRandomId() {
            return crypto.createHash('sha256').update(String(Math.random())).digest('hex')
        }





        /**
         * return the express middleware
         */
        express(app) {
            app.use(this.route.bind(this));
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
