(function() {
    'use strict';


    const Hook = require('./Hook');
    const log = require('ee-log');
    const type = require('ee-types');



    const debug = process.argv.includes('--debug-service') || process.env.debugService;




    module.exports = class Response extends Hook {


        ok(data) {
            this.data = data;
            this.status = 'ok';
            this.send();
        }


        error(code, message, err) {
            if (debug && err) log(err);

            this.err = err;
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


        conflict(message) {
            this.message = message;
            this.status = 'conflict';
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




        tooManyRequests(interval, credits, creditsLeft) {
            this.message = `Rate limit exceeded: you've got ${credits} per ${interval} seconds, you have currently ${creditsLeft} left!`;
            this.status = 'tooManyRequests';
            this.interval = interval;
            this.credits = credits;
            this.creditsLeft = creditsLeft;
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



        /**
         * pipes the other response into
         * this one
         */
        pipe(originalResponse) {
            if (originalResponse.data) this.data = originalResponse.data;
            if (originalResponse.message) this.message = originalResponse.message;
            if (originalResponse.status) this.data = originalResponse.status;

            return this.send();
        }




        hasData() {
            return !type.undefined(this.data);
        }

        hasObjectData() {
            return type.object(this.data);
        }



        set onAfterListQuery(listener) {
            this.storeHook('afterListQuery', listener);
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


    // a shared set of methods avialable on the 
    module.exports.prototype.actions = new Set();
})();
