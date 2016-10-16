(function() {
    'use strict';


    const Hook = require('./Hook');
    const log = require('ee-log');
    const type = require('ee-types');



    const debug = process.argv.indexOf('debug-service') >= 0 || process.env.debugService;




    module.exports = class Response extends Hook {


        ok(data) {
            this.data = data;
            this.status = 'ok';
            this.send();
        }


        error(code, message, err) {
            if (debug && err) log(err);

            this.error = err;
            this.code = code;
            this.message = message;
            this.status = 'error';
            this.send();
        }


        notFound(message) {
            this.message = message;
            this.status = 'notFound';
            this.send();
        }


        invalidAction(message) {
            this.message = message;
            this.status = 'invalidAction';
            this.send();
        }


        badRequest(code, message) {
            this.message = message;
            this.code = code;
            this.status = 'badRequest';
            this.send();
        }


        serviceUnavailable(code, message) {
            this.message = message;
            this.code = code;
            this.status = 'serviceUnavailable';
            this.send();
        }


        forbidden(code, message) {
            this.message = message;
            this.code = code;
            this.status = 'forbidden';
            this.send();
        }



        authorizationRequired(resource, action) {
            this.message = `You are not allowed execute the action ${action} on the ${this.serviceName}:${resource} resource!`;
            this.code = 'authorization_required';
            this.status = 'authorizationRequired';
            this.send();
        }



        send() {
            return this.executeHook('beforeSend', this).then(() => {
                return this.executeHook('send', this).then(() => {
                    return this.executeHook('afterSend', this);
                    Object.freeze(this);
                }).then(() => {
                    return this.clearHooks();
                }).catch((err) => {
                    log(err);
                });
            }).catch((err) => {
                this.error = err;
                this.message = 'The beforeSend hook returned an error!';

                return this.executeHook('send', this).catch(log);
            });
        }



        hasData() {
            return !type.undefined(this.data);
        }

        hasObjectData() {
            return type.object(this.data);
        }




        set onSend(listener) {
            this.storeHook('send', listener);
        }

        set onBeforeSend(listener) {
            this.storeHook('beforeSend', listener);
        }

        set onAfterSend(listener) {
            this.storeHook('afterSend', listener);
        }
    };
})();
