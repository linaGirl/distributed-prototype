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

            this.loaded = false;
            this.loading = false;
            this.loadingQueue = [];
            this.loadingTimeout = 60000; // 1 min.


            // the services name
            this.name = options.name;

            // link to all resources
            this.resources = new Map();

            // distributed permissions
            this.permissions = new PermissionManager(this);
        }






        getName() {
            return this.name;
        }

        isLoaded() {
            return !!this.loaded;
        }

        isLoading() {
            return !!this.loading;
        }

        hasFailed() {
            return !!this.error;
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






        registerResource(resource) {
            if (this.resources.has(resource.getName())) throw new Error(`Cannot register resource ${resource.getName()}, it was already registred before!`);

            // redirect outgoing requests
            resource.onRequest = (request, response) => this.sendRequest(request, response);

            resource.setService(this.name);

            this.resources.set(resource.getName(), resource);
        }







        load() {
            if (this.hasFailed()) return Promise.reject(this.error);
            else if (this.isLoaded()) return Promise.resolve();
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
                    this.executeLoad()
                        .then(() => {
                            clearTimeout(timeoutTimer);
                            this.fininshedLoading();
                        })
                        .catch(err => this.fininshedLoading(err));
                });


                // add to queue
                return this.load();
            }
        }




        getResourceNames() {
            return Array.from(this.resources.keys());
        }





        executeLoad() {
            return this.permissions.load().then((token) => {
                this.token = token;

                return this.loadResourceControllers();
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
            }


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
                        } else response.notFound(`The resource ${request.resource} does not exist!`);
                    }
                } else response.authorizationRequired(request.resource, request.action);
            }).catch(err => response.error('permissions_error', `Failed to load permissions while processing the request on the service ${this.name} and the resource ${request.resource} with the action ${request.action}!`, err));
        }







        set onRequest(listener) {
            this.storeHook('request', listener);
        }
    }
})();
