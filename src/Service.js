(function() {
    'use strict';


    const Hook = require('./Hook');
    const type = require('ee-types');
    const log = require('ee-log');
    const PermissionManager = require('./PermissionManager');
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

            // all services have permisisons support
            this.permissions = new PermissionManager(this);
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
            resource.setService(this.name);
            resource.setPermissionManager(this.permissions);

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
         * does the actuak loading
         */
        executeLoad() {
            return this.permissions.load().then((token) => {
                this.token = token;


                // dont accept new resource ocntrollers anymore
                this.lockControllerRegistration = true;
                return this.loadResourceControllers().then(() => {
                    this.lockControllerRegistration = false;

                    return Promise.resolve();
                });
            });
        }







        loadResourceControllers() {
            if (!this.resources.size) return Promise.resolve();
            else return Promise.all(Array.from(this.resources.keys()).map(name => this.resources.get(name).load(name))).then(() => Promise.resolve());
        }







        sendRequest(request, response) {

            // attach sender service
            request.requestingService = this.name;


            if (this.token)  {
                if (!request.tokens) request.tokens = [];
                request.tokens.push(this.token);
            }// else log.warn('not adding token', this.getName());


            // internal or external handling?
            if (request.getService() === this.name) this.receiveRequest(request, response);
            else if (!this.hasHooks('request')) response.error('no_listeners', `Cannot send outgoing request, no one is listening on the request hook of the ${this.name} service!`);
            else return this.executeHook('request', request, response);
        }





        receiveRequest(request, response) {
            this.dispatchRequest(request, response);
        }






        dispatchRequest(request, response) {
            response.serviceName = this.name;


            if (debug) {
                const id = ++requestId;

                const timeout = setTimeout(() => {
                    log.warn(`[${id}] Long running request on ${request.action} ${request.service}/${request.resource}!`);
                }, 1000);

                response.onAfterSend = () => {
                    clearTimeout(timeout);
                }
            }

            // check permissions
            this.permissions.getActionPermissions(request).then((permissions) => {
                if (permissions.isActionAllowed()) {
                    if (!this.loaded) response.serviceUnavailable('service_not_loaded', `The service was not yet loaded completely. Try again later!`)
                    else {
                        if (this.resources.has(request.resource)) {
                            this.resources.get(request.resource).receiveRequest(request, response, permissions);
                        } else response.notFound(`The resource ${request.resource} does not exist on the ${this.getName()} service!`);
                    }
                } else response.authorizationRequired(request.resource, request.action);
            }).catch(err => response.error('permissions_error', `Failed to load permissions while processing the request on the service ${this.name} and the resource ${request.resource} with the action ${request.action}!`, err));
        }







        set onRequest(listener) {
            this.storeHook('request', listener);
        }
    }
})();
