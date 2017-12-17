{
    'use strict';

    const ResponseRenderer = require('./Renderer');
    const log = require('ee-log');


    module.exports = class JsonResponseRenderer extends ResponseRenderer {
        

        constructor() {
            super();


            // best match for the json type
            this.registerType('application', 'json', 1000);

            // we'll be always able to return json
            // use this renderer as fallback
            this.registerType('*', '*', 1);
            this.registerType('text', '*', 10);
        }







        /**
        * don't do too much. just send the data to the client
        */
        async render({
            httpRequest, 
            httpResponse, 
            distributedRequest,
            distributedResponse,
        }) {
            const statusCode = this.getHTTPStatus(distributedResponse.status);

            if (statusCode >= 400 && statusCode < 600) {
                // render an error response!
                httpResponse
                    .status(statusCode)
                    .type('application/json')
                    .send({
                        status: statusCode,
                        code: distributedResponse.status,
                        description: distributedResponse.toError().message,
                    });
            } else {
                httpResponse
                    .status(statusCode)
                    .type('application/json')
                    .send(distributedResponse.data);
            }
        }
    }
}