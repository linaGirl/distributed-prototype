(function() {
    'use strict';


    const Service = require('./Service');
    const ResourceController = require('./ResourceController');
    const log = require('ee-log');





    class PermissionController extends ResourceController {

        constructor(options) {
            super('authorization');
            this.enableAction('listOne');
        }




        listOne(request, response) {
            this.capture(request, response);
        }
    };







    module.exports = class TestPermissionsService extends Service {


        constructor(options) {
            options = options || {};
            options.name = 'permissions';
            super(options);
        }




        once(listener) {
            this.listener = listener;
            this.once = true;
        }



        intercept(listener) {
            this.listener = listener;
            this.once = false;
        }



        cancelIntercept() {
            this.listener = null;
        }



        capture(request, response) {
            if (this.listener) {
                this.listener(request, response);
                if (this.once) this.listener = null;
            }
            else response.notFound(`There was no permission slistener registeredd, sorry!`);
        }



        executeLoad() {
            const controller = new PermissionController();

            controller.capture = this.capture.bind(this);

            this.registerResource(controller);


            return Promise.resolve();
        }
    };
})();
