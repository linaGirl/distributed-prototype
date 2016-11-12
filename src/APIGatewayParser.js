(function() {
    'use strict';



    const fork      = require('child_process').fork;
    const type      = require('ee-types');
    const log       = require('ee-log');
    const path      = require('path');





    module.exports = class APIGatewayParser {

        constructor(options) {

            // headers are beeing parsed and cached
            // in separate child processes
            this.threadCount = options && options.threadCount ? options.threadCount : 3;
            this.threads = [];

            // next thread to use
            this.threadIndex = 0;

            // message id
            this.index = 0;

            // child id
            this.childIndex = 0;

            // message callback storage
            this.promises = new Map();


            // create threads
            for (let i = 0; i < this.threadCount; i++) {
                this.forkChild();
            }
        }







        parse(data) {
            return this.sendMessage('parse', data);
        }






        sendMessage(action, data) {
            const id = this.id;


            // do the promise thingy
            return new Promise((resolve, reject) => {

                // get child
                const child = this.child;


                // add to response queue
                this.promises.set(id, {
                      resolve   : resolve
                    , reject    : reject
                    , id        : child.id
                    , messageId : id
                });


                // send message
                child.send({
                      id        : id
                    , action    : action
                    , data      : data
                });
            });
        }







        forkChild() {
            const child = fork(path.join(__dirname, 'APIGatewayParserChild.js'));


            // give it an id
            child.id = this.childId;




            // if it dies we needd to cancel all promises
            child.on('exit', () => {


                // remove old one
                this.threads = this.threads.filter(t => t.id !== child.id);


                // create a new one
                this.forkChild();

                // cancel all pending promises
                for (const promise of this.promises.values()) {
                    if (promise.id === child.id) {
                        promise.reject(new Error(`Failed to parse request: the parser failed!`));
                        this.promises.delete(promise.messageId);
                    }
                }
            });



            // incoming data, responses
            child.on('message', (message) => {
                const promise = this.promises.get(message.id);

                // remove from map
                this.promises.delete(message.id);

                if (promise) {
                    if (message.status === 'ok') promise.resolve(message.data);
                    else promise.reject(new Error(message.message));
                } else log.warn(`The APIGatewayParser got a message for which it has no promise stored. That's bad as fuck!`);
            });


            // store for later use
            this.threads.push(child);
        }









        /**
         * returns the next child
         */
        get child() {
            if (this.threadIndex+1 === this.threadCount) this.threadIndex = 0;
            else this.threadIndex++;
            return this.threads[this.threadIndex];
        }







        /**
         * get the next message id
         */
        get id() {
            if (this.index === Number.MAX_SAFE_INTEGER) this.index = 0;
            else this.index++;
            return this.index;
        }






        /**
         * get the next child id
         */
        get childId() {
            if (this.childIndex === Number.MAX_SAFE_INTEGER) this.childIndex = 0;
            else this.childIndex++;
            return this.childIndex;
        }
    };
})();
