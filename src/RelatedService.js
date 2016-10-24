(function() {
    'use strict';


    const RelationalService = require('./RelationalService');
    const RelatedResourceController = require('./RelatedResourceController');
    const log = require('ee-log');
    const type = require('ee-types');





    module.exports = class RelatedService extends RelationalService {




        constructor(options) {
            super(options);

            if (!type.object(options.db)) throw new Error(`Missing the db property on the options object while contructing the RelatedService instance for the ${options.name} Service!`);

            // the service can load controllers
            // automatically
            this.autoloadTables = new Set();


            // need the dbs name for later
            this.dbName = options.db.schema || options.db.database;
        }






        registerAutoloadTables() {
            return Promise.all(Array.from(this.autoloadTables).map((tableName) => {
                this.registerResource(new RelatedResourceController(this.resourceControllerOptions, tableName));
                return Promise.resolve();
            }));
        }







        executeLoad() {
            return Promise.resolve().then(() => {
                if (type.function(this.beforeLoad)) return this.beforeLoad();
                else return Promise.resolve();
            }).then(() => {
                return this.registerAutoloadTables();
            }).then(() => {
                if (type.function(this.afterLoad)) return this.afterLoad();
                else return Promise.resolve();
            }).then(() => {
                return super.executeLoad();
            });
        }







        autoLoad(tableName) {
            this.autoloadTables.add(tableName);
        }
    };
})();
