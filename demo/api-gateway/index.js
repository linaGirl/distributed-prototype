{
	'use strict';

	const log = require('ee-log');
	const APIGateway = require('../../src/APIGatewayService');


	process.on('unhandledRejection', (reason, p) => {
        log(reason);
    });



	new APIGateway({
		port: 8000
	}).load().then(() => {
		log.success(`Gateway listening on http://api.l.dns.porn:8000/`);
	}).catch(log);
}