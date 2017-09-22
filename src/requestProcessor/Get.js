{
    'use strict';

    const log = require('ee-log');
    const RequestProcessor = require('./RequestProcessor');







    module.exports = class GetRequestProcessor extends RequestProcessor {




        /**
        * handles all required steps to process 
        * an incoming GET request
        */
        async processRequest({
            request, 
            response,
        }) {
            
            // get the basic request configuration
            const requestConfiguration = await this.getRequestConfiguration(request);

            // parse the headers
            const selection = await this.parseSelection({request, requestConfiguration});
            const filter = await this.parseFilter(request);
            
            

            log({requestConfiguration, selection, filter});
        }



        
    }
}