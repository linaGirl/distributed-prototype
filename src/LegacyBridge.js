(function() {
    'use strict';

    const log                       = require('ee-log');
    const type                      = require('ee-types');
    const EventEmitter              = require('ee-event-emitter');
    const LegacyRequestTranslator   = require('./LegacyRequestTranslator');



    module.exports = class LegacyBridge extends EventEmitter {

        constructor(serviceManager) {
            super();

            this.serviceManager = serviceManager;

            // lsiten for requests that
            this.serviceManager.onRequest = this.handleOutgoingRequest.bind(this);

            // convert requests
            this.converter = new LegacyRequestTranslator();
        }




        isService() {
            return true;
        }




        request(legacyRequest, legacyResponse) {
            this.converter.fromLegacy(legacyRequest, legacyResponse).then((result) => {
                /*result.response.onSend = () => {
                    log(result.response)
                };*/
                //log(result.request);

                try {
                    this.serviceManager.handleRequest(result.request, result.response);
                } catch (e) {log(e)};
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
            this.serviceManager.load().then(callback).catch(callback);
        }

    }
})();
