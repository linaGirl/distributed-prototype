(function() {
    'use strict';

    const assert = require('assert');
    const log = require('ee-log');
    const Response = require('./Response');
    const type = require('ee-types');




    module.exports = class Request {


        constructor(options) {
            if (type.object(options)) {
                if (options.resource)           this.setResource(options.resource);
                if (options.service)            this.setService(options.service);
                if (options.action)             this.setAction(options.action);
                if (options.tokens)             this.setTokens(options.tokens);
                if (options.token)              this.setToken(options.token);
                if (options.options)            this.setOptions(options.options);
                if (options.origin)             this.setOrigin(options.origin);
                if (options.requestId)          this.setRequestId(options.requestId);
                if (options.responseFormats)    this.setResponseFormats(options.responseFormats);
            }
        }







        /**
        * stores the origin request on this request
        */
        setOrigin(request) {
            this.originRequest = request;
        }

        getOrigin() {
            return this.originRequest || null;
        }

        hasOrigin() {
            return !!this.originRequest;
        }







        /**
        * the unique request id for request tracing
        */
        setRequestId(requestId) {
            this.requestId = requestId;
        }

        getRequestId() {
            return this.requestId || null;
        }

        hasRequestId() {
            return !!this.requestId;
        }








        /**
        * handles mimetypes requested by the user
        */
        hasResponseFormat(identifier) {
            return this.reponseFormat && this.reponseFormat.has(identifier);
        }


        addResponseFormat(identifier) {
            if (!this.reponseFormat) this.reponseFormat = new Set();
            this.reponseFormat.add(identifier);
        }


        getResponseFormats() {
            return this.reponseFormat ? Array.from(this.reponseFormat) : [];
        }


        setResponseFormats(formats) {
            assert(Array.isArray(formats), `responseFormats must be an array!`);
            formats.forEach(format => this.addResponseFormat(format));
        }









        setToken(token) {
            if (!type.string(token)) throw new Error(`Expecting a string when setting the token on the request, got ${type(token)} instead!`);
            if (!token.length) throw new Error(`Expecting a non empty string when setting the token on the request!`);
            if (!type.array(this.tokens)) this.tokens = [];
            this.tokens.push(token);
            return this;
        }

        setTokens(tokens) {
            if (!type.array(tokens)) this.setToken(tokens);
            else tokens.forEach(token => this.setToken(token));
            return this;
        }

        getTokens() {
            return this.tokens;
        }

        hasToken(token) {
            return Array.isArray(this.tokens);
        }







        setAction(action) {
            if (!type.string(action)) throw new Error(`Expecting a string when setting the action on the request, got ${type(action)} instead!`);
            if (!action.length) throw new Error(`Expecting a non empty string when setting the action on the request!`);
            this.action = action;
            return this;
        }

        getAction() {
            return this.action || null;
        }

        hasAction() {
            return !!this.action;
        }







        setResource(resource) {
            if (!type.string(resource)) throw new Error(`Expecting a string when setting the resource on the request, got ${type(resource)} instead!`);
            if (!resource.length) throw new Error(`Expecting a non empty string when setting the resource on the request!`);
            this.resource = resource;
            return this;
        }

        getResource() {
            return this.resource;
        }

        hasResource() {
            return !!this.resource;
        }






        setService(service) {
            if (!type.string(service)) throw new Error(`Expecting a string when setting the service on the request, got ${type(service)} instead!`);
            if (!service.length) throw new Error(`Expecting a non empty string when setting the service on the request!`);
            this.service = service;
            return this;
        }

        getService() {
            return this.service;
        }

        hasService() {
            return !!this.service;
        }








        setOptions(input) {
            if (type.map(input)) input.forEach((value, key) => this.setOption(key, value));
            else if (type.object(input)) Object.keys(input).forEach(key => this.setOption(key, input[key]));
            else throw new Error(`Expecting aon object or a map when setting options on the request, got ${type(input)} instead!`);
        }

        setOption(key, value) {
            if (!type.string(key)) throw new Error(`Expecting a string as key when setting an option on the request, got ${type(key)} instead!`);
            if (!key.length) throw new Error(`Expecting a non empty string as key when setting an option on the request!`);

            // make storage
            if (!this.options) this.options = new Map();

            // store
            this.options.set(key, value);
            return this;
        }

        hasOption(name) {
            return this.options && this.options.has(name);
        }

        getOption(name) {
            return this.hasOption(name) ? this.options.get(name) : undefined;
        }





        /**
        * stores a trusted module, which is one that is added 
        * the local service
        */
        setTrustedModule(name, module) {
            if (!this.trustedModules) this.trustedModules = new Map();
            this.trustedModules.set(name, module);
        }

        /**
        * checks if a trusted modules is present
        */
        hasTrustedModule(name) {
            return this.trustedModules && this.trustedModules.has(name)
        }

        /**
        * retuns a given trusted module
        */
        getTrustedModule(name) {
            return this.hasTrustedModule(name) ? this.trustedModules.get(name) : null;
        }

        /**
        * removes all trusted modules
        */
        clearTrustedModules() {
            if (this.trustedModules) this.trustedModules = new Map();
        }






        /**
        * sends the request using the passed gateway
        * and creates and returns the response as soon it 
        * was sent by the other side
        */
        send(gateway) {
            this.response = this.createResponse();

            // validate outgoing requests, respond
            // directly on error!
            try {
                this.validate();
            } catch (err) { log(err);

                process.nextTick(() => {
                    this.response.error('request_format_error', `The request could not be sent because it was malformed!`, err);
                });

                return new Promise((resolve, reject) => {
                    this.response.onAfterSend = () => resolve(this.response);
                });
            }



            process.nextTick(() => {
                gateway.sendRequest(this, this.response);
            });

            return new Promise((resolve, reject) => {
                this.response.onAfterSend = () => resolve(this.response);
            });
        }


        /**
        * returns the response for the request
        */
        getResponse() {
            return this.response;
        }







        hasData() {
            return !type.undefined(this.data);
        }

        hasObjectData() {
            return type.object(this.data);
        }






        validate() {
            if (!this.hasService()) throw new Error(`Missing the service on the Request!`);
            if (!this.hasResource()) throw new Error(`Missing the resource on the Request!`);
        }







        createResponse() {
            return new Response();
        }
    }
})();
