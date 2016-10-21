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

                            this.storeItems();
                        }
                    }
                };
            }


            this.queue = process.distributedPermissionsLearning.queue;
        }




        learn(service, resource, action, roles) {
            if (roles.length) {
                this.queue.push({
                      service   : service
                    , resource  : resource
                    , action    : action
                    , roles     : roles
                });
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

                            return Promise.resolve(result.roles.map((roleName) => {
                                return new RelationalRequest({
                                      action    : 'createOne'
                                    , service   : 'permissions'
                                    , resource  : 'authorization'
                                    , data: {
                                          service   : item.service
                                        , resource  : item.resource
                                        , action    : item.action
                                        , role      : roleName.trim()
                                    }
                                }).send(this.service).then((response) => {
                                    if (response.status === 'created') return Promise.resolve();
                                    else return Promise.reject(`Failed to store the permissions: ${response.message}`);
                                });
                            })).then(next);
                        }).catch(log);


                        //console.log('----------------------------------------------------------------------------------'.grey);
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
