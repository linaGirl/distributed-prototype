(function() {
    'use strict';


    const EventEmitter = require('ee-event-emitter');
    const type = require('ee-types');
    const log = require('ee-log');
    const LegacyRequestTranslator = require('./LegacyRequestTranslator');





    module.exports = class ServiceBridge extends EventEmitter {


        constructor(service, options) {
            super();

            this.service = service;
            this.service.onRequest = this.handleOutgoingRequest.bind(this);

            // permission overriding for tests
            if (options && options.options && options.options.getPermissions) this.getPermissions = options.options.getPermissions;


            // encapsulated request translation
            this.converter = new LegacyRequestTranslator({
                serviceName: this.service.getName()
            });
        }







        handleOutgoingRequest(request, response) {


            // so, there we are with a distributed permissions management
            // emulatee it!
            if (request.getService() === 'permissions' && request.getResource() === 'permission') this.getPermissions(request, response);
            else {

                // get legacy representation
                this.converter.toLegacy(request, response).then((result) => {
                    this.emit('request', result.request, result.response);
                });
            }
        }







        request(legacyRequest, legacyResponse) {
            this.converter.fromLegacy(legacyRequest, legacyResponse).then((result) => {
                this.service.receiveRequest(result.request, result.response);
            });
        }







        getPermissions(request, response) {
            const permission = {
                  token: '435e4fcwfyd'
                , type: 'app'
                , id: 45
            };

            permission.data = new Map([['userId', 1]]);
            permission.roles = new Set(['root', 'user']);
            permission.permissions = new Map();
            permission.capabilities = new Set();

            response.ok([permission]);
        }






        onLoad(callback) {
            this.service.load().then(callback).catch(callback);
        }

    }
})();
