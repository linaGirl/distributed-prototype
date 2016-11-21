(function() {
    'use strict';


    const Response = require('./Response');
    const log = require('ee-log');
    const type = require('ee-types');





    module.exports = class RelationalResponse extends Response {

        created(...ids) {
            this.status = 'created';

            this.data = {
                  serviceName: this.serviceName
                , resourceName: this.resourceName
                , id: ids && ids.length === 1 ? ids[0] : ids
            };

            this.send();
        }




        noContent(...ids) {
            this.status = 'noContent';

            this.data = {
                  serviceName: this.serviceName
                , resourceName: this.resourceName
                , id: ids && ids.length === 1 ? ids[0] : ids
            };

            this.send();
        }
    };
})();
