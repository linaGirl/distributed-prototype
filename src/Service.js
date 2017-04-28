(function() {
    'use strict';


    const Hook = require('./Hook');
    const type = require('ee-types');
    const log = require('ee-log');
    const debug = process.argv.includes('--debug-service') || process.env.debugService;



    let requestId = 0;




    module.exports = class Service extends Hook {




        constructor(options) {
            super();

            // basic input valdiation
            if (!type.object(options)) throw new Error(`The distributed service constructor expects an options object, got ${type(options)}!`);
            if (!type.string(options.name) || !options.name.length) throw new Error(`The distributed service expects a non empty name property on the options object!`);

            // loading status
            this.loaded = false;
            this.loading = false;
            this.loadingQueue = [];
            this.loadingTimeout = 60000; // 1 min.


            // the services name
            this.name = options.name;

            // resource controller storage
            this.resources = new Map();

            // middleware storage
            this.incomingMiddlewares = [];
            this.outgoingMidddlewares = [];

            // storeg for tracking which middleware
            // was loaded already
            this.loadedMiddlewares = new Set();
        }




        /**
        * the service has to shut dwon
        */
        end() { 
            return Promise.all(Array.from(this.resources.values()).map(resourceController => resourceController.end()));
        }





        /**
         * returns the serrvice name
         */
        getName() {
            return this.name;
        }


        /**
         * true if fully loaded
         */
        isLoaded() {
            return !!this.loaded;
        }


        /**
         * true if currently beeing loaded
         */
        isLoading() {
            return !!this.loading;
        }


        /**
         * if loading the service failed this
         * will return true
         */
        hasFailed() {
            return !!this.error;
        }



        /**
         * deprecated! here for legacy reasons
         */
        getResourceNames() {
            return Array.from(this.resources.keys());
        }





        fininshedLoading(err) {
            if (err) {
                this.error = err;
                log.error(`Failed to load service ${this.getName()}:`);
                log(err);
            }

            // dont flag as loaded when encountering errors
            if (!this.error) this.loaded = true;
            this.loading = false;

            if (this.loadingQueue) this.loadingQueue.forEach(p => this.hasFailed() ? p.reject(this.error) : p.resolve());
            this.loadingQueue = null;
        }











        /**
         * register a new resource on the service
         */
        registerResource(resource) {
            if (!type.object(resource) || !type.function(resource.getName)) throw new Error(`Cannot register a resource on the '${this.getName()}' service that is not an object or does not expose the resource.getName() method!`);
            if (this.resources.has(resource.getName())) throw new Error(`Cannot register resource '${resource.getName()}' on the '${this.getName()}' service, it was already registred before!`);
            if (this.lockControllerRegistration) throw new Error(`Cannot add resource controller '${resource.getName()}' on the '${this.getName()}' service while the service is beeing loaded, add it before or after it's beeing loaded!`);
            if (this.hasFailed()) throw new Error(`Cannot add resource controller '${resource.getName()}' on the '${this.getName()}' service: the service has failed!`);

            // redirect outgoing requests
            resource.onRequest = (request, response) => this.sendRequest(request, response);

            // pass the resource some needed information
            resource.setServiceName(this.name);

            // trigger the load method on the resource
            // if the service has finished loading
            if (this.isLoaded()) resource.load();

            this.resources.set(resource.getName(), resource);
        }






        /**
         * public load method
         */
        load() {
            return this.prepareLoading();
        }






        /**
         * basic loading logic, calls the executeLoad method
         */
        prepareLoading() {
            if (this.isLoaded()) return Promise.resolve();
            else if (this.hasFailed()) return Promise.reject(Error(`Cannot load the ${this.getName()} service, it has failed (see service.error)!`));
            else if (this.isLoading()) {
                return new Promise((resolve, reject) => {
                    this.loadingQueue.push({
                          resolve: resolve
                        , reject: reject
                    });
                });
            } else {
                this.loading = true;


                // cancel loading after some time
                const timeoutTimer = setTimeout(() => {
                    this.fininshedLoading(new Error(`Failed to load service ${this.getName()}, timeout was triggered after ${this.loadingTimeout} milliseconds!`));
                }, this.loadingTimeout);


                // start loading after we return
                process.nextTick(() => {
                    this.executeLoad().then(() => {

                        // k, we dont need the timeout anymore
                        clearTimeout(timeoutTimer);
                        this.fininshedLoading();
                    }).catch(err => this.fininshedLoading(err));
                });


                // add to queue
                return this.prepareLoading();
            }
        }





        /**
         * load all middleware, load the controllers
         */
        executeLoad() {
            return Promise.all(this.incomingMiddlewares.map((middleware) => {
                if (this.loadedMiddlewares.has(middleware)) return Promise.resolve();
                else {
                    this.loadedMiddlewares.add(middleware);
                    return middleware.load(this);
                }
            })).then(() => {
                return Promise.all(this.outgoingMidddlewares.map((middleware) => {
                    if (this.loadedMiddlewares.has(middleware)) return Promise.resolve();
                    else {
                        this.loadedMiddlewares.add(middleware);
                        return middleware.load(this);
                    }
                }));
            }).then(() => {

                // dont accept new resource ocntrollers anymore
                this.lockControllerRegistration = true;
                return this.loadResourceControllers().then(() => {
                    this.lockControllerRegistration = false;

                    return Promise.resolve();
                });
            });
        }






        /**
        * sets the token of this service
        * so that ourgoing requests are authenticated
        * as request originating from this service
        */
        setToken(token) {
            this.token = token;
        }






        loadResourceControllers() {
            if (!this.resources.size) return Promise.resolve();
            else return Promise.all(Array.from(this.resources.keys()).map(name => this.resources.get(name).load(name))).then(() => Promise.resolve());
        }









        /**
        * returns a gateway obejct the can be used to send requests
        */
        createGateway() {
            return {
                sendRequest: (request, response) => {
                    this.sendRequest(request, response);
                }

                , getName: () => {
                    return this.getName();
                }
            };
        }










        /**
         * handles middlewares for outgoing requests, 
         * routes them either to an internal target
         * or diaptches it to the outside
         */
        sendRequest(request, response) {

            // attach sender service
            request.requestingService = this.name;


            // add my token on outgoing requests
            if (this.token) request.setToken(this.token);


            
            if (debug) {
                log.debug(`[Distributed] Outgoing request to ${request.service}/${request.resource}${request.resourceId ? `/${request.resourceId}` : ''} -> ${request.action}...`);
                response.onAfterSend = () => {
                    log.info(`[Distributed] Incoming response from ${request.service}/${request.resource}${request.resourceId ? `/${request.resourceId}` : ''} -> ${request.action} with the status ${response.status}...`);
                };
            }




            // process using middlewares
            this.processOutgoingMiddleWares(request, response).then((halt) => {
                
                // if halt is true the response is handled
                // by a middleware
                if (!halt) {
                    

                    // internal or external handling?
                    if (request.getService() === this.name) this.receiveRequest(request, response);
                    else if (!this.hasHooks('request')) response.error('no_listeners', `Cannot send outgoing request, no one is listening on the request hook of the ${this.name} service!`);
                    else return this.executeHook('request', request, response);
                }
            }).catch(err => response.error('middleware_error', `Failed to process request on the outgoing middlewares!`, err));
        }










        /**
        * incoming requests from the outside
        */
        receiveRequest(request, response) {
            this.dispatchRequest(request, response);
        }











        /**
        * routes the request through the incoming middlewares,
        * disptches them to the correct controller
        */
        dispatchRequest(request, response) {
            response.serviceName = this.name;


            if (debug) {
                const id = ++requestId;
                const start = Date.now();

                const timeout = setInterval(() => {
                    log.warn(`[${id}] Long running request on ${request.service}/${request.resource}${request.resourceId ? `/${request.resourceId}` : ''} -> ${request.action}!`);
                }, 1000);


                log.info(`[Distributed][${id}] Incoming request on ${request.service}/${request.resource}${request.resourceId ? `/${request.resourceId}` : ''} -> ${request.action} ...`);
                response.onSend = () => {
                    log.success(`[Distributed][${id}] Outgoing response from ${request.service}/${request.resource}${request.resourceId ? `/${request.resourceId}` : ''} -> ${request.action} with the status ${response.status}${type.array(response.data) ? ` and ${response.data.length} records` : '' } after ${Date.now()-start} ms...`);
                    clearInterval(timeout);
                };
            }



            // make sure there is no injected code
            request.clearTrustedModules();


            // check if we're redy to process requests
            if (!this.loaded) response.serviceUnavailable('service_not_loaded', `The service ${this.getName()} was not yet loaded completely. Try again later!`);
            else {

                // handle middlewares
                this.processIncomingMiddleWares(request, response).then((halt) => {
                    
                    // if halt is true the response is handled
                    // by a middleware
                    if (!halt) {
                        if (this.resources.has(request.resource)) {
                            this.resources.get(request.resource).receiveRequest(request, response);
                        } else response.notFound(`The resource ${request.resource} does not exist on the ${this.getName()} service!`);
                    }
                }).catch(err => response.error('middleware_error', `Failed to process request on the incoming middlewares!`, err));
            }
        }









        /**
        * execute outgoing midddlewares on the request
        */
        processOutgoingMiddleWares(request, response, index = 0) {
             if (this.outgoingMidddlewares.length > index) {
                return this.outgoingMidddlewares[index].processOutgoingRequest(request, response).then((halt) => {
                    if (halt) return Promise.resolve(true);
                    else return this.processOutgoingMiddleWares(request, response, index+1);
                });
            } else return Promise.resolve();
        }








        /**
        * execute incoming midddlewares on the request
        */
        processIncomingMiddleWares(request, response, index = 0) {
             if (this.incomingMiddlewares.length > index) {
                return this.incomingMiddlewares[index].processIncomingRequest(request, response).then((halt) => {
                    if (halt) return Promise.resolve(true);
                    else return this.processIncomingMiddleWares(request, response, index+1);
                });
            } else return Promise.resolve();
        }









        /**
        * user defined middlewares for incoming requests
        */
        use(middleware) {
            if (type.object(middleware) && middleware.hookIncomingRequests()) this.incomingMiddlewares.push(middleware);
            if (type.object(middleware) && middleware.hookOutgoingRequests()) this.outgoingMidddlewares.push(middleware);
        }








        set onRequest(listener) {
            this.storeHook('request', listener);
        }
    }
})();
