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



        accepted(...ids) {
            this.status = 'accepted';

            this.data = {
                  serviceName: this.serviceName
                , resourceName: this.resourceName
                , id: ids && ids.length === 1 ? ids[0] : ids
            };
            this.send();
        }




        seeOther(...ids) {
            this.status = 'seeOther';
            
            this.data = {
                  serviceName: this.serviceName
                , resourceName: this.resourceName
                , id: ids && ids.length === 1 ? ids[0] : ids
            };
            this.send();
        }



        /**
         * creates a proper error for each status
         */
        toError() {
            switch (this.status) {
                case 'seeOther':
                case 'accepted':
                case 'noContent':
                case 'created':
                    return new Error(`Canont create Error from response since the response has the status ${this.status} which ois not an error!`);

                default:
                    return super.toError();
            }
        }
    };
})();
