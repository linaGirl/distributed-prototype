(function() {
    'use strict';


    const RelationalService = require('./RelationalService');
    const RelatedResourceController = require('./RelatedResourceController');
    const log = require('ee-log');
    const type = require('ee-types');





    module.exports = class RelatedService extends RelationalService {




        constructor(options) {
            super(options);

            // the service can load controllers
            // automatically
            this.autoloadTables = new Set();


            // need the dbs name for later
            this.dbName = options.db.schema || options.db.database;
        }





        registerAutoloadTables() {
            return Promise.all(Array.from(this.autoloadTables).map((tableName) => {
                this.registerResource(tableName, new RelatedResourceController(this.resourceControllerOptions, tableName));
                return Promise.resolve();
            }));
        }







        load() {
            return Promise.resolve().then(() => {
                if (type.function(this.beforeLoad)) return this.beforeLoad();
                else return Promise.resolve();
            }).then(() => {
                return this.registerAutoloadTables();
            }).then(() => {
                if (type.function(this.afterLoad)) return this.afterLoad();
                else return Promise.resolve();
            }).then(() => {
                return super.load();
            });
        }







        autoLoad(tableName) {
            this.autoloadTables.add(tableName);
        }
    };
})();
