(function() {
    'use strict';

    const log                       = require('ee-log');
    const type                      = require('ee-types');
    const EventEmitter              = require('ee-event-emitter');
    const LegacyRequestTranslator   = require('./LegacyRequestTranslator');



    module.exports = class LegacyBridge extends EventEmitter {



        constructor(legacyService) {
            super();


            this.legacyService = legacyService;


            // convert requests
            this.converter = new LegacyRequestTranslator();
        }







        sendRequest(request, response) {


            // get legacy representation
            this.converter.toLegacy(request, response).then((result) => {
                this.emit('request', result.request, result.response);
            });
        }
    }
})();
