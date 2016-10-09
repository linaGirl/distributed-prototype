(function() {
    'use strict';

    const type = require('ee-types');
    const log = require('ee-log');
    const Response = require('./Response');




    module.exports = class Request {


        constructor(options) {
            if (type.object(options)) {
                if (options.resource) this.resource = options.resource;
                if (options.serviceName) this.serviceName = options.serviceName;
                if (options.action) this.action = options.action;
                if (options.tokens) this.tokens = options.tokens;

                if (type.object(options.options)) Object.keys().forEach(k => this.setOption(k, options.options[k]));
            }
        }



        setOption(name, value) {
            if (!this.options) this.options = new Map();
            this.options.set(name, value);
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

            process.nextTick(() => {
                receiver.sendRequest(this, response);
            });

            return new Promise((resolve, reject) => {
                response.onAfterSend = () => resolve(response);
            });
        }




        createResponse() {
            return new Response();
        }
    }
})();
