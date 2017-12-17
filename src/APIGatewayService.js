(function() {
    'use strict';



    const Server = require('./Server');
    const Service = require('./Service');
    const type = require('ee-types');
    const log = require('ee-log');
    const Parser = require('./APIGatewayParser');
    const RequestBuilder = require('./APIGatewayRequestBuilder');
    const crypto = require('crypto');



    const DeleteRequestProcessor = require('./requestProcessor/Delete');
    const GetRequestProcessor = require('./requestProcessor/Get');
    const HeadRequestProcessor = require('./requestProcessor/Head');
    const OptionsRequestProcessor = require('./requestProcessor/Options');
    const PatchRequestProcessor = require('./requestProcessor/Patch');
    const PostRequestProcessor = require('./requestProcessor/Post');
    const PutRequestProcessor = require('./requestProcessor/Put');


    const GetResponseProcessor = require('./responseProcessor/Get');
    const PostResponseProcessor = require('./responseProcessor/Post');
    const OptionsResponseProcessor = require('./responseProcessor/Options');








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
            this.requestProcessors = new Map([
                ['delete', new DeleteRequestProcessor({parser: this.parser})],
                ['get', new GetRequestProcessor({parser: this.parser})],
                ['head', new HeadRequestProcessor({parser: this.parser})],
                ['options', new OptionsRequestProcessor({parser: this.parser})],
                ['patch', new PatchRequestProcessor({parser: this.parser})],
                ['post', new PostRequestProcessor({parser: this.parser})],
                ['put', new PutRequestProcessor({parser: this.parser})],
            ]);


            // load the different response processors
            this.responseProcessors = new Map([
                ['get', new GetResponseProcessor()],
                ['post', new PostResponseProcessor()],
                ['options', new OptionsResponseProcessor()],
            ]);



            // register this as middleware on the server
            this.addRouter();
        }





        /**
         * express middleware
         */
        route(httpRequest, httpResponse) {
            const requestId = this.createRandomId();
            const action = httpRequest.method.toLowerCase();


            this.processRequest({
                httpRequest,
                httpResponse,
                requestId,
                action,
            }).catch((err) => {
                if (err instanceof Error) {
                    
                    // log info, this should never happen
                    log.warn(`Uncaught error for httpRequest ${requestId}`, {
                        method: action,
                        requestId: requestId,
                        url: httpRequest.url,
                        rawHeaders: httpRequest.rawHeaders,
                    });
                    
                    log(err);
                    
                    // don't tell the client any details
                    httpResponse.status(500).send({
                        status: 500,
                        code: 'server_error',
                        description: `The server encountered an error while processing the httpRequest. Request-id: ${requestId}`
                    });
                } else if (type.object(err) && err.status && err.code) {

                    // custom parser error
                    httpResponse.status(err.status).send({
                        status: err.status,
                        code: err.code,
                        description: err.description
                    });
                }
            });
        }






        /**
        * convert http to distributed and back again
        * 
        */
        async processRequest({
            httpRequest,
            httpResponse,
            requestId,
            action,
        }) {
            if (this.requestProcessors.has(action) && this.responseProcessors.has(action)) {

                // let specialized classes do the work
                const distributedRequest = await this.requestProcessors.get(action).processRequest({
                    httpRequest, 
                    httpResponse,
                    requestId,
                });

                // send the request
                const distributedResponse = await distributedRequest.send(this);

                // send the response
                await this.responseProcessors.get(action).processResponse({
                    httpRequest, 
                    httpResponse,
                    distributedRequest,
                    distributedResponse,
                });
            } else {
                httpResponse.status(405).send({
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
