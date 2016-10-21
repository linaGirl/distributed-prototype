(function() {
    'use strict';

    const log = require('ee-log');
    const RelationalRequest = require('./RelationalRequest');
    const type = require('ee-types');
    const crypto = require('crypto');
    const path = require('path');
    const fs = require('fs');
    const inquirer = require('inquirer');



    const learningSession = process.env.learnPermissions || process.argv.some(a => a === '--learn-permissions');




    module.exports = class PermissionTokenManager {


        constructor(service) {
            this.service = service;
        }







        load() {
            if (!learningSession) return Promise.resolve();
            else if (this.service.getName() === 'permissions') return Promise.resolve();
            else {
                try {
                    return this.loadFromFS().then((token) => {
                        if (token) {
                            return Promise.resolve(token);
                        } else {
                            return this.loadFromPermissionsService().then((token) => {
                                return Promise.resolve(token);
                            });
                        }
                    }).catch(log);
                } catch (e) {log(e)}
            }
        }





        loadFromPermissionsService() {

            return this.getUserInput({
                  type: 'password'
                , message: 'Please enter the projects root password, enter a new one if you havent entered one before!'
            }).then((password) => {

                return this.request(this.service.getName(), password).then((token) => {

                    // async but not waiting ot be completed!
                    process.distributedPermissionsManager.storeToken(this.service.getName(), token);


                    return Promise.resolve(token);
                });
            });
        }








        request(service, password) {
            const startTime = Date.now();
            const timeoutTime = 10000;

            const register = () => {
                if (Date.now() > (startTime+timeoutTime)) return Promise.reject(new Error(`Failed to get the service token, the request timed out!`));
                else {
                    return new RelationalRequest({
                          action        : 'createOrUpdate'
                        , service       : 'permissions'
                        , resource      : 'serviceToken'
                        , data: {
                              service       : service
                            , password      : password
                        }
                    }).send(this.service).then((response) => {
                        if (response.status === 'ok') return Promise.resolve(response.data.token);
                        else if (response.status === 'serviceUnavailable') {

                            // try again
                            return new Promise((resolve, reject) => {
                                setTimeout(() => {
                                    register().then(resolve).catch(reject);
                                }, 250);
                            });
                        }
                        else return Promise.reject(new Error(`Failed to laod the service token: status ${response.status}: ${response.message}`));
                    });
                }
            };

            return register();
        }







        storeToken() {
            if (!this.storageBusy) {
                this.storageBusy = true;

                if (this.storageQueue.length) {
                    const item = this.storageQueue.shift();


                    this.loadJSONFile().then((data) => {
                        if (!type.object(data)) data = {};

                        data[item.service] = item.token;

                        return this.storeJSONFile(data).then(() => {

                            process.nextTick(() => {
                                this.storeToken();
                            });
                        });
                    }).catch(log);
                } else this.storageBusy = false;
            }
        }







        getUserInput(question) {


            // make sure this is done once per process
            if (!process.distributedPermissionsManager) {

                // create a queue wher all services can
                // put their request
                this.queue = [];
                this.storageQueue = [];

                // add to glbal namespace
                process.distributedPermissionsManager = {
                    queue: {
                        push: (item) => {
                            this.queue.push(item);
                            this.executeItem();
                        }
                    }
                    , storeToken: (service, token) => {
                        this.storageQueue.push({
                            service: service
                            , token: token
                        });

                        this.storeToken();
                    }
                };
            }


            return new Promise((resolve, reject) => {
                process.distributedPermissionsManager.queue.push({
                      resolve   : resolve
                    , reject    : reject
                    , question  : question
                });
            });
        }




        executeItem() {
            if (!this.busy) {
                this.busy = true;

                if (this.queue.length) {
                    const item = this.queue.shift();

                    if (this.password) {
                        item.resolve(this.password);
                        this.executeItem();
                    } else {
                        item.question.name = 'value';

                        inquirer.prompt([item.question]).then((results) => {

                            this.password = crypto.createHash('sha1').update(results.value || '').digest('hex');
                            item.resolve(this.password);

                            this.executeItem();
                        }).catch(item.reject);
                    }
                } else this.busy = false;
            }
        }



        loadFromFS() {
            return new Promise((resolve, reject) => {
                fs.stat(process.argv[1], (err, stats) => {
                    if (err) reject(err);
                    else {
                        this.projectRoot = stats.isDirectory() ? process.argv[1] : path.dirname(process.argv[1]);
                        this.jsonConfigFilePath = path.join(this.projectRoot, '.tokens.json');

                        this.loadJSONFile().then((tokens) => {

                            // so, do we have a token?
                            resolve(tokens && tokens[this.service.getName()] ? tokens[this.service.getName()] : null);
                        }).catch(reject);
                    }
                });
            })
        }




        storeJSONFile(data) {
            return new Promise((resolve, reject) => {
                try {

                    fs.writeFile(this.jsonConfigFilePath, JSON.stringify(data, true, 4), (err, data) => {
                        if (err) reject(err);
                        else resolve();
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }


        loadJSONFile() {
            return new Promise((resolve, reject) => {
                try {

                    fs.readFile(this.jsonConfigFilePath, (err, data) => {
                        if (err) resolve({});
                        else if (data) resolve(JSON.parse(data.toString()));
                        else resolve({});
                    });
                } catch (e) {log(e);
                    reject(e);
                }
            });
        }
    }
})();
