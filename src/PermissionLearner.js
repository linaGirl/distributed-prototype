(function() {
    'use strict';

    const log               = require('ee-log');
    const inquirer          = require('inquirer');
    const type              = require('ee-types');
    const RelationalRequest = require('./RelationalRequest');





    module.exports = class PermissionLearner {


        constructor(service, manager) {
            this.service = service;
            this.manager = manager;


            this.busy = false;


            // make sure we're working on
            // a process wid thingy
            if (!process.distributedPermissionsLearning) {

                this.items = new Map();

                // i'm the master
                process.distributedPermissionsLearning = {
                      busy: false
                    , queue: {
                        push:(item) => {

                            // create unique id, dont ask the user more than once
                            const id = `${item.service}::${item.resource}:${item.action}`;

                            if (!this.items.has(id)) {
                                this.items.set(id, {
                                      roles     : new Set()
                                    , service   : item.service
                                    , resource  : item.resource
                                    , action    : item.action
                                });
                            }

                            const set = this.items.get(id).roles;
                            item.roles.forEach(r => set.add(r));

                            setTimeout(() => {
                                this.storeItems();
                            }, 1000);
                        }
                    }
                };
            }


            this.queue = process.distributedPermissionsLearning.queue;
        }




        learn(service, resource, action, roles) {
            if (service !== 'permissions' && resource !== 'authorization' && action !== 'createOne') {
                if (roles.length) {
                    this.queue.push({
                          service   : service
                        , resource  : resource
                        , action    : action
                        , roles     : roles
                    });
                }
            }
        }





        storeItems() {
            if (!this.busy) {
                this.busy = true;

                const next = () => {
                    if (this.items.size) {
                        const key = Array.from(this.items.keys())[0];
                        const item = this.items.get(key);
                        this.items.delete(key);

                        // inquirere is so shitty!
                        console.log('');

                        inquirer.prompt([{
                              type      : 'checkbox'
                            , message   : 'Create permissions for '.white+item.action.red+' action on the '.white+item.service.blue+'/'.grey+item.resource.green+' resource?'.white
                            , name      : 'roles'
                            , choices   : Array.from(item.roles).map(r => ({name: ' '+r}))
                        }]).then((result) => {

                            // save one permission after another to avoid conflicts
                            // due to concurrent inserts
                            const saveNext = (index) => {
                                if (result.roles.length > index) {
                                    return new RelationalRequest({
                                          action    : 'createOne'
                                        , service   : 'permissions'
                                        , resource  : 'authorization'
                                        , data: {
                                              service   : item.service
                                            , resource  : item.resource
                                            , action    : item.action
                                            , role      : result.roles[index].trim()
                                        }
                                    }).send(this.service).then((response) => {
                                        if (response.status === 'created') return saveNext(index+1);
                                        else return Promise.reject(`Failed to store the permissions: ${response.message}`);
                                    });
                                } else return Promise.resolve();
                            };


                            return saveNext(0).then(next).catch((err) => {
                                log.warn(`Failed to create permission ${item.service}/${tem.resource}:${item.action} for the role(s) ${result.roles.join(', ')}`);
                            });
                        }).catch(log);
                    } else {
                        this.busy = false;
                    }
                };

                // ask user
                next();
            }
        }
    }
})();
