(function() {
    'use strict';



    const Server    = require('./Server');
    const Service   = require('./Service');
    const type      = require('ee-types');
    const log       = require('ee-log');







    module.exports = class WebsiteService extends Service {

        constructor(options) {
            if (!type.object(options)) throw new Error(`The WebsiteService is missing the options object!`);
            if (!options.name) options.name = 'website';

            super(options);

            this.port = options.port || 80;


            // create the express erver
            this.server = new Server({
                port: this.port
            });


            // use this as middleware
            this.server.use(this);
        }






        /**
         * get the express app
         */
        express(app) {
            this.app = app;
        }







        /**
         * laod the controllers, pass them the express app
         */
        loadResourceControllers() {
            if (!this.resources.size) return Promise.resolve();
            else return Promise.all(Array.from(this.resources.keys()).map(name => this.resources.get(name).load(this.app))).then(() => Promise.resolve());
        }





        /**
         * start the local server, then pass back which will
         * laod the controlelrs
         */
        executeLoad() {
            return super.executeLoad().then(() => {
                return this.server.listen();
            });
        }
    };
})();
