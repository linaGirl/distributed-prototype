(function() {
    'use strict';

    const type = require('ee-types');
    const log = require('ee-log');
    const Response = require('./Response');




    module.exports = class Request {


        constructor(options) {
            if (type.object(options)) {
                if (options.resource) this.setResource(options.resource);
                if (options.service) this.setService(options.service);
                if (options.action) this.setAction(options.action);
                if (options.tokens) this.setTokens(options.tokens);
                if (options.options) this.setOptions(options.options);
            }
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







        send(receiver) {
            const response = this.createResponse();

            // validate outgoing requests, repond
            // directly on error!
            try {
                this.validate();
            } catch (err) { log(err);

                process.nextTick(() => {
                    response.error('request_format_error', `The request could not be sent because it was malformed!`, err);
                });

                return new Promise((resolve, reject) => {
                    response.onAfterSend = () => resolve(response);
                });
            }



            process.nextTick(() => {
                receiver.sendRequest(this, response);
            });

            return new Promise((resolve, reject) => {
                response.onAfterSend = () => resolve(response);
            });
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
