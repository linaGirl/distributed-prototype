(function() {
    'use strict';


    const ResourceController = require('./ResourceController');
    const RelationalResourceDefinition = require('./RelationalResourceDefinition');
    const RelationalRequest = require('./RelationalRequest');
    const FilterBuilder = require('./FilterBuilder');
    const RelationalSelection = require('./RelationalSelection');
    const type = require('ee-types');
    const log = require('ee-log');
    const assert = require('assert');






    module.exports = class RelationalResourceController extends ResourceController {


        constructor(name) {
            super(name);
            this.relations = new Map();
            this.definition = new RelationalResourceDefinition({name: name});

            // storage for the referencing keys registered on this resource
            this.referencingKeys = new Map();

            // the controller infrastructure can handle localized
            // data that is stored on other entities that belong to 
            // this entitiy. this flags that sich an entity is available
            this.isLocalized = false;
        }








        /**
        * enable support for data localization via a remote table
        */
        enableLocalization({
              localProperty
            , remoteResource
            , remoteService = this.getServiceName()
            , remoteProperty
            , remoteLanguageProperty = 'languageId'
            , languageService
            , languageResource
            , languageProperty
            , languageCodeProperty
        }) {

            this.isLocalized = true;

            // save the config
            this.localizationConfig = {
                  localProperty: localProperty
                , remote: {
                      service: remoteService
                    , resource: remoteResource
                    , property: remoteProperty
                    , languageProperty: remoteLanguageProperty
                }
                , language: {
                      service: languageService
                    , resource: languageResource
                    , property: languageProperty
                    , codeProperty: languageCodeProperty
                }
            };


            // we're caching the resolved languages
            this.languageCache = new Map(); 
        }








        /**
        * handles the locales for listings
        */
        async loadLocaleData({languages = [], records, selection = new Set()} = {}) {
            if (this.isLocalized && records) {
                const config = this.localizationConfig;
                assert(languages && Array.isArray(languages), `option 'languages' must be an array!`);
                const blacklistendColumns = ['id', config.remote.languageProperty, config.remote.property];


                // collect our ids
                const localRowMap = new Map();
                records.forEach((row) => {
                    localRowMap.set(row[config.localProperty], row);
                });


                // start building the filrer
                const filter = new FilterBuilder().and();


                // add our ids 
                filter.property(config.remote.property).comparator('in').value(Array.from(localRowMap.keys()));


                // get the languages ids                
                const languageData = await this.resolveLanguage(config.language, languages);
    

                // filter the languages
                filter.property(config.remote.languageProperty).comparator('in').value(languageData.map(r => r[config.language.property]));


                // lets get the locales
                const response = await (new RelationalRequest({
                        action: 'list'
                      , service: config.remote.service
                      , resource: config.remote.resource
                      , filter: filter
                      , selection: Array.from(selection)
                }).send(this));


                if (response.status === 'ok') {
                    const data = response.data;

                    if (data && Array.isArray(data) && data.length) {
                        const languageIds = languageData.map(x => x.id);

                        // order by the languages delivered by the original request
                        data.sort((a, b) => {
                            return languageIds.indexOf(a[config.remote.languageProperty]) - languageIds.indexOf(b[config.remote.languageProperty]);
                        });

                        // apply row by row, not that fast, but there should never too mcuh data
                        for (const locale of data) {
                            const localeProperties = Object.keys(locale).filter(column => !blacklistendColumns.includes(column));
                            const currentRow = localRowMap.get(locale[config.remote.property]);

                            // iterat
                            for (const property of localeProperties) {
                                const value = locale[property];
                                const localValue = currentRow[property];

                                if (value !== null && 
                                    value !== undefined &&
                                    currentRow && (
                                        localValue === null ||
                                        localValue === undefined ||
                                        localValue === "")) {

                                    currentRow[property] = value;
                                }
                            }
                        }                    
                    }
                } else throw response.toError();
            } else {
                if (selection.has('*')) selection.delete('*');

                if (selection.size) throw new Error(`Cannot select properties '${Array.from(selection).join(`', '`)}' on the ${this.getServiceName()}/${this.getName()} resource. The properties do not exist!`);
            }
        }








        /**
        * get language ids. implementing this here
        * since we're working on the prototype and
        * implementing caching on the framework is a nogo
        * for the prototoype since it would be lost effort
        */
        resolveLanguage(config, codes) {
            return Promise.all(codes.map((code) => {
                if (this.languageCache.has(code)) return this.languageCache.get(code);
                else {
                    const promise = new RelationalRequest({
                            action: 'list'
                          , service: config.service
                          , resource: config.resource
                          , selection: [config.property, config.codeProperty]
                          , filter: new FilterBuilder().property(config.codeProperty).comparator('=').value(code)
                    }).send(this).then((response) => {
                        if (response.status === 'ok') {
                            if (response.data && Array.isArray(response.data) && response.data.length) return Promise.resolve(response.data[0]);
                            else return Promise.resolve();
                        } return Promise.reject(response.toError());
                    });


                    this.languageCache.set(code, promise);

                    return promise;
                }   
            })).then((results) => {
                return Promise.resolve(results.filter(item => !!item));
            });
        }









        enableActions() {
            this.enableAction('createOne');
            this.enableAction('createOneRelation');
            this.enableAction('createOrUpdate');
            this.enableAction('createOrUpdateOne');
            this.enableAction('createOrUpdateOneRelation');
            this.enableAction('deleteOne');
            this.enableAction('deleteOneRelation');
            this.enableAction('describe');
            this.enableAction('listOne');
            this.enableAction('registerRelation');
            this.enableAction('updateOne');
            this.enableAction('updateOneRelation');
        }




        



        registerRelation(request, response) {
            const data = request.data;

            if (type.object(data)) {
                try {
                    switch (request.data.type) {
                        case 'reference':
                            this.registerReference(request.data.name, request.data);
                            break;


                        case 'belongsTo':
                            this.registerBelongsTo(request.data.name, request.data);
                            break;


                        case 'mapping':
                            this.registerMapping(request.data.name, request.data);
                            break;

                        default:
                            response.badRequest('invalid_relation_type', `The relation with the unknown type ${data.type} cannot be registered on the resource ${this.getName()}!`);
                            return;
                    }
                } catch (err) {
                    response.error('registration_error', `Failed to register the ${request.data.type} relation from ${this.getServiceName()}/${this.getName()} to ${request.data.service}/${request.data.resource}!`, err);
                }

                // nice, registration was ok
                response.ok();

            }
            else response.badRequest('missing_request_body', `The relation cannot be registered on the resource ${this.getName()} becuase the request contains no data!`);
        }















        createOrUpdateOneRelation(request, response) {
            const mode = 'createOrUpdate';

            // redirect to the bulk method
            if (this.definition.primaryIds.length > 1) response.badRequest('invalid_call', `Cannot accept createOrUpdateOneRelation request on a resource with more than one primary id!`);
            else this.handleRelationalWrite({request, response, mode});
        }






        createOneRelation(request, response) {
            const mode = 'create';

            // redirect to the bulk method
            if (this.definition.primaryIds.length > 1) response.badRequest('invalid_call', `Cannot accept createOneRelation request on a resource with more than one primary id!`);
            else this.handleRelationalWrite({request, response, mode});
        }






        updateOneRelation(request, response) {
            const mode = 'update';

            // redirect to the bulk method
            if (this.definition.primaryIds.length > 1) response.badRequest('invalid_call', `Cannot accept updateOneRelation request on a resource with more than one primary id!`);
            else this.handleRelationalWrite({request, response, mode});
        }






        deleteOneRelation(request, response) {
            const mode = 'delete';

            // redirect to the bulk method
            if (this.definition.primaryIds.length > 1) response.badRequest('invalid_call', `Cannot accept deleteOneRelation request on a resource with more than one primary id!`);
            else this.handleRelationalWrite({request, response, mode});
        }







        handleRelationalWrite({request, response, mode}) {
            if (this.relations.has(request.remoteService)) {
                const relations = this.relations.get(request.remoteService);


                if (relations.has(request.remoteResource)) {
                    const relation = relations.get(request.remoteResource);

                    switch (relation.type) {

                        case 'reference':

                            // set the relations key
                            if (!request.data) request.data = {};
                            request.data[relation.property] = mode === 'delete' ? null : request.remoteResourceId; 

                            // just patch the local resource
                            return this.update(request, response);



                        case 'belongsTo':

                            // swap adressing and send to remote to process as reference!
                            // keep it simple stupid
                            [request.service, request.remoteService] = [request.remoteService, request.service];
                            [request.resource, request.remoteResource] = [request.remoteResource, request.resource];
                            [request.resourceId, request.remoteResourceId] = [request.remoteResourceId, request.resourceId];

                            return this.sendRequest(request, response);



                        case 'mapping':

                            if (mode !== 'create') {
                                // only the create method does not need a filter
                                const filter = new FilterBuilder().and();

                                filter.property(relation.via.localProperty).comparator('=').value(request.resourceId);
                                filter.property(relation.via.remoteProperty).comparator('=').value(request.remoteResourceId);

                                request.setFilter(filter);
                            }


                            // set the correct action
                            switch (mode) {
                                case 'create': 
                                    request.setAction('createOne');
                                    break;

                                case 'update': 
                                    request.setAction('update');
                                    break;

                                case 'createOrUpdate': 
                                    request.setAction('createOrUpdate');
                                    break;

                                case 'delete': 
                                    request.setAction('delete');
                                    break;

                                default: 
                                    return response.error('server_error', `Invalid mode '${mode}' when workign on the relation between ${this.getServiceName()}/${this.getName()} and ${request.remoteService}/${request.remoteResource}!`);
                            }


                            if (mode !== 'delete') {
                                // delete needs no payload
                                if (!request.data) request.data = {};
                                request.data[relation.via.localProperty] = request.resourceId; 
                                request.data[relation.via.remoteProperty] = request.remoteResourceId;
                            }

                            // re-reoute
                            request.setService(relation.via.service);
                            request.setResource(relation.via.resource);


                            // go!
                            return this.sendRequest(request, response);


                        default: 
                            return response.error('invalid_relation_type', `Cannot resolve the relation between ${this.getServiceName()}/${this.getName()} and ${request.remoteService}/${request.remoteResource}, relation type ${relation.type} unknonwn!`);
                    }
                } else response.badRequest('unknown_relation', `Cannot resolve the relation between ${this.getServiceName()}/${this.getName()} and ${request.remoteService}/${request.remoteResource}, relation unknonwn!`);
            } else response.badRequest('unknown_relation', `Cannot resolve the relation between ${this.getServiceName()}/${this.getName()} and ${request.remoteService}/${request.remoteResource}, relation unknonwn!`);
        }











        createOrUpdateOne(request, response) {

            // check if the resource exists, update if yes, create if no
            new RelationalRequest({
                  service: request.service
                , resource: request.resource
                , resourceId: request.resourceId
                , action: 'listOne'
            }).send(this).then((listResponse) => {
                if (listResponse.status === 'notFound') request.setAction('createOne');
                else request.setAction('updateOne');

                return this.sendRequest(request, response);
            }).catch(err => response.error('server_error', `Failed to execute request!`, err));
        }











        createOrUpdate(request, response) {

            // check if the resources exist, update if yes, create new if no
            new RelationalRequest({
                  service: request.service
                , resource: request.resource
                , filter: request.filter
                , action: 'list'
            }).send(this).then((listResponse) => {
                if (listResponse.status === 'notFound' || !Array.isArray(listResponse.data) || !listResponse.data.length) request.setAction('createOne');
                else request.setAction('update');

                return this.sendRequest(request, response);
            }).catch(err => response.error('server_error', `Failed to execute request!`, err));
        }











        createOne(request, response) {
            request.data = [request.data];

            // remove array on the response
            response.onBeforeSend = () => {
                if (response.data && type.array(response.data.id)) response.data.id = response.data.id[0];
            };

            return this.create(request, response);
        }







        deleteOne(request, response) {
            if (!this.definition.hasPrimaryId()) return response.error('no_primary_id', `the resource has no or multiple primary ids and can only be deleted using the delete action!`);
            else {


                // ammend the filter, send off to the list method
                this.applyDeleteOneFilter(request);


                // get no more than one
                request.limit = 1;


                return this.delete(request, response);
            }
        }


        applyDeleteOneFilter(request) {
            const originalFilter = request.filter;
            request.filter = new FilterBuilder();
            request.filter.and()
                    .addChild(originalFilter)
                    .property(this.definition.primaryId)
                    .comparator('=')
                    .value(request.resourceId);
        }









        updateOne(request, response) {
            if (!this.definition.hasPrimaryId()) return response.error('no_primary_id', `the resource has no or multiple primary ids and can only be updated using the update action!`);
            else {

                // remove array in response
                response.onBeforeSend = () => {
                    if (response.data && response.data.id && response.data.id.length) response.data.id = response.data.id[0];
                };

                // ammend the filter, send off to the list method
                this.applyUpdateOneFilter(request);


                // get no more than one
                request.limit = 1;


                return this.update(request, response);
            }
        }

        applyUpdateOneFilter(request) {
            const originalFilter = request.filter;
            request.filter = new FilterBuilder();
            request.filter.and()
                    .addChild(originalFilter)
                    .property(this.definition.primaryId)
                    .comparator('=')
                    .value(request.resourceId);
        }









        listOne(request, response) {
            if (!this.definition.hasPrimaryId()) return response.error('no_primary_id', `the resource has no or multiple primary ids and can only be fetched using the list action!`);
            else {

                // remove array on the response
                response.onBeforeSend = () => {
                    if (response.data && response.data.length) response.data = response.data[0];
                    else {
                        if (response.status === 'ok') {
                            response.status = 'notFound';
                            response.data = undefined;
                            response.message = `Could not load the ${this.getServiceName()}/${this.getName()} with the key ${request.resourceId}!`;
                        }
                    }
                };

                // ammend the filter, send off to the list method
                this.applyListOneFilter(request);


                // get no more than one
                request.limit = 1;

                return this.list(request, response);
            }
        }


        applyListOneFilter(request) {
            // thereis one exception for the filter,
            // normally the primary is queried, but
            // if the id is not a number and there is
            // a field identifier we're going to filter
            // that
            const property = (this.definition.hasProperty('identifier') && /[^0-9]/.test(request.resourceId+'')) ? 'identifier' : this.definition.primaryId;
            const originalFilter = request.filter;


            if (this.definition.hasProperty(property) && this.definition.getProperty(property).type === 'number') {
                try {
                    request.resourceId = parseInt(request.resourceId, 10);
                } catch (e) {}
            }

            request.filter = new FilterBuilder();
            request.filter.and()
                    .addChild(originalFilter)
                    .property(property)
                    .comparator('=')
                    .value(request.resourceId);
        }









        remoteRelationRegistration(service, resource, definition) {
            const startTime = Date.now();
            const timeoutTime = this.remoteRegistrationTimeoutTime || 10000;

            const register = () => {
                if (Date.now() > (startTime+timeoutTime)) return Promise.reject(new Error(`The registration of the remote relation ${definition.name} timed out after ${timeoutTime}!`));
                else {
                    return new RelationalRequest({
                          service: service
                        , resource: resource
                        , action: 'registerRelation'
                        , data: definition
                    }).send(this).then((response) => {
                        if (response.status === 'ok') return Promise.resolve();
                        else if (response.status === 'serviceUnavailable' || response.status === 'authorizationRequired') {

                            // try again
                            return new Promise((resolve, reject) => {
                                setTimeout(() => {
                                    register().then(resolve).catch(reject);
                                }, 500);
                            });
                        }
                        else return Promise.reject(response.toError());
                    });
                }
            };

            return register();
        }









        describe(request, response) {
            const data = {};

            // basics
            data.service        = this.getServiceName();
            data.resource       = this.getName();
            data.actions        = Array.from(this.actionRegistry);
            data.primaryKeys    = this.definition.primaryIds || [];
            data.permissions    = {};
            data.properties     = [];
            data.relations      = [];


            // local properties
            for (const property of this.definition.properties.values()) {
                data.properties.push({
                      name              : property.name
                    , type              : property.type
                    , representation    : property.representation
                    , nullable          : property.nullable
                    , readonly          : null
                });
            }


            const permissions = request.getTrustedModule('permissions');


            // set permissions on local entity
            for (const action of this.actionRegistry) {
                data.permissions[action] = permissions.isActionAllowed(this.getServiceName(), this.getName(), action);
            }



            // add has one relation definitions
            if (request.hasOption('withoutRelations')) return response.ok(data);
            else {
                return Promise.all(Array.from(this.relations.values()).map((service) => {
                    return Promise.all(Array.from(service.values()).map((relation) => {
                        const definition = {
                              type: relation.type === 'mapping' ? 'hasManyAndBelongsToMany' : (relation.type === 'belongsTo' ? 'hasMany' : 'hasOne')
                            , name: relation.name
                            , property: relation.property
                        };

                        data.relations.push(definition);


                        if (relation.type === 'reference') {
                            definition.remote = {
                                  service   : relation.remote.service
                                , resource  : relation.remote.resource
                                , property  : relation.remote.property
                            };

                            definition.actions = null;
                            definition.permissions = null;


                            return new RelationalRequest({
                                  service   : definition.remote.service
                                , resource  : definition.remote.resource
                                , action    : 'describe'
                                , tokens    : request.tokens
                                , options   : {withoutRelations: true}
                            }).send(this).then((remoteResponse) => {
                                if (remoteResponse.status === 'ok' && remoteResponse.hasObjectData()) {
                                    if (remoteResponse.data.permissions)  definition.permissions = remoteResponse.data.permissions;
                                    if (remoteResponse.data.actions)      definition.actions = remoteResponse.data.actions;

                                    definition.permissions.createLink = true;
                                    definition.permissions.updateLink = true;
                                    definition.permissions.deleteLink = true;
                                }

                                return Promise.resolve();
                            });
                        } else if (relation.type === 'belongsTo') {
                            definition.remote = {
                                  service   : relation.remote.service
                                , resource  : relation.remote.resource
                                , property  : relation.remote.property
                            };


                            return new RelationalRequest({
                                  service   : definition.remote.service
                                , resource  : definition.remote.resource
                                , action    : 'describe'
                                , tokens    : request.tokens
                                , options   : {withoutRelations: true}
                            }).send(this).then((remoteResponse) => {
                                if (remoteResponse.status === 'ok' && remoteResponse.hasObjectData()) {
                                    if (remoteResponse.data.permissions)  definition.permissions = remoteResponse.data.permissions;
                                    if (remoteResponse.data.actions)      definition.actions = remoteResponse.data.actions;

                                    definition.permissions.createLink = definition.permissions.create || definition.permissions.createOne || false;
                                    definition.permissions.updateLink = definition.permissions.update || definition.permissions.updateOne || false;
                                    definition.permissions.deleteLink = definition.permissions.delete || definition.permissions.deleteOne || false;
                                }

                                return Promise.resolve();
                            });
                        }
                        else if (relation.type === 'mapping') {
                            definition.remote = {
                                  service   : relation.remote.service
                                , resource  : relation.remote.resource
                                , property  : relation.remote.property
                            };

                            definition.via = {
                                  service           : relation.via.service
                                , resource          : relation.via.resource
                                , localProperty     : relation.via.localProperty
                                , remoteProperty    : relation.via.remoteProperty
                            };

                            return new RelationalRequest({
                                  service   : definition.remote.service
                                , resource  : definition.remote.resource
                                , action    : 'describe'
                                , tokens    : request.tokens
                                , options   : {withoutRelations: true}
                            }).send(this).then((remoteResponse) => {
                                if (remoteResponse.status === 'ok' && remoteResponse.hasObjectData()) {
                                    if (remoteResponse.data.permissions)  definition.permissions = remoteResponse.data.permissions;
                                    if (remoteResponse.data.actions)      definition.actions = remoteResponse.data.actions;


                                    return new RelationalRequest({
                                          service   : definition.via.service
                                        , resource  : definition.via.resource
                                        , action    : 'describe'
                                        , tokens    : request.tokens
                                        , options   : {withoutRelations: true}
                                    }).send(this).then((viaResponse) => {
                                        if (viaResponse.status === 'ok' && viaResponse.hasObjectData() && viaResponse.data.permissions && viaResponse.data.actions) {
                                            const has = p => !!viaResponse.data.permissions[p];
                                            const can = a => viaResponse.data.actions.includes(a);

                                            definition.permissions.createLink = (can('create') && has('create')) || (can('createOne') && has('createOne'));
                                            definition.permissions.updateLink = (can('update') && has('update')) || (can('updateOne') && has('updateOne'));
                                            definition.permissions.deleteLink = (can('delete') && has('delete')) || (can('deleteOne') && has('deleteOne'));
                                        }

                                        return Promise.resolve();
                                    });
                                } else return Promise.resolve();
                            });
                        }
                        else  throw new Error(`Unknown relation ${relation.type}!`);
                    }));
                })).then(() => {
                    response.ok(data);
                }).catch(err => response.error('permissions_error', `Failed to load permissions!`, err));
            }
        }








        resolveRelations(data) {


            // if a property of the data is an object and
            // it's a reference we should resolve it and
            // replace it by the referenced resources id
            if (type.object(data)) {
                return Promise.all(Object.keys(data).map((propertyName) => {
                    try {
                        if (type.object(data[propertyName]) || type.array(data[propertyName])) {

                            if (this.hasRelation(this.getServiceName(), propertyName)) {
                                const relationDefinition = this.getRelation(this.getServiceName(), propertyName);

                                if (relationDefinition.type === 'reference' && type.object(data[propertyName])) {
                                    const filter = new FilterBuilder();
                                    const andFilter = filter.and();

                                    Object.keys(data[propertyName]).forEach((key) => {


                                        // use the in function when working with multiple values
                                        if (Array.isArray(data[propertyName][key])) andFilter.property(key).fn('in', data[propertyName][key]);
                                        else andFilter.property(key).comparator('=').value(data[propertyName][key]);
                                    });

                                    return new RelationalRequest({
                                          resource  : relationDefinition.remote.resource
                                        , filter    : filter
                                        , service   : relationDefinition.remote.service
                                        , selection : relationDefinition.remote.property
                                        , action    : 'list'
                                    }).send(this).then((response) => {
                                        if (response.status === 'ok') {
                                            delete data[propertyName];
                                            if (response.data && response.data.length) data[relationDefinition.property] = response.data[0][relationDefinition.remote.property];
                                            return Promise.resolve();
                                        } else return Promise.reject(response.toError());
                                    }).catch(err => Promise.reject(new Error(`Failed to load referenced relational selection ${relationDefinition.remote.resource}: ${err.message}`)));
                                } else if ((relationDefinition.type === 'mapping' || relationDefinition.type === 'belongsTo') && type.array(data[propertyName])) {
                                    const filter = new FilterBuilder();
                                    const orFilter = filter.or();

                                    data[propertyName].forEach((relation) => {
                                        const andFilter = orFilter.and();

                                        Object.keys(relation).forEach((key) => {

                                            // use the in function when working with multiple values
                                            if (Array.isArray(relation[key])) andFilter.property(key).fn('in', relation[key]);
                                            else andFilter.property(key).comparator('=').value(relation[key]);
                                        });
                                    });


                                    return new RelationalRequest({
                                          resource  : relationDefinition.remote.resource
                                        , filter    : filter
                                        , service   : relationDefinition.remote.service
                                        , selection : relationDefinition.remote.property
                                        , action    : 'list'
                                    }).send(this).then((response) => {
                                        if (response.status === 'ok') {
                                            delete data[propertyName];
                                            if (response.data && response.data.length) data[relationDefinition.remote.resource] = response.data;
                                            return Promise.resolve();
                                        } else return Promise.reject(response.toError());
                                    }).catch(err => Promise.reject(new Error(`Failed to load belongs to relational selection ${relationDefinition.remote.resource}: ${err.message}`)));
                                } else return Promise.resolve();
                            }
                        } else return Promise.resolve();
                    } catch (err) {
                        return Promise.reject(err);
                    }
                }));
            } else return Promise.resolve();
        }







        loadRelationanlSelections(request, records) {

            // no need to load data if there is no data
            // locally
            if (!records || (Array.isArray(records) && !records.length)) return Promise.resolve();
            if (!Array.isArray(records)) records = [records];

            // check if there are any related resources
            // requested
            if (request.hasRelationalSelection()) {
                const selection = request.getRelationalSelection();

                return Promise.all(Array.from(selection.keys()).map((relationalSelectionName) => {
                    return this.loadRelationalSelection(records, selection.get(relationalSelectionName), request);
                })).then(() => Promise.resolve(records));
            } else return Promise.resolve();
        }







        loadRelationalSelection(records, relationalSelection, originRequest) {
            if (!this.hasRelation(relationalSelection.service, relationalSelection.resource)) return Promise.reject(new Error(`The relation ${relationalSelection.service}/${relationalSelection.resource} does not exist!`));
            else {
                const relationDefinition = this.getRelation(relationalSelection.service, relationalSelection.resource);


                if (relationDefinition.type === 'reference' || relationDefinition.type === 'belongsTo') {
                    return this.loadRelationalRecords(relationDefinition, relationalSelection, records, originRequest).then(((results) => {
                        this.combineRemoteRecords(relationDefinition, records, results);
                        return Promise.resolve(records);
                    }));
                }
                else if (relationDefinition.type === 'mapping') return this.loadRelationalMapping(relationDefinition, relationalSelection, records, originRequest);
                else return Promise.reject(`The relation ${relationDefinition.name} has an invalid type ${relationDefinition.type}!`);
            }
        }







        loadRelationalMapping(relationDefinition, relationalSelection, records, originRequest) {

            // select the mapping table
            const selection = new RelationalSelection({
                  resource: relationDefinition.via.resource
                , selection: [relationDefinition.via.localProperty]
                , service: relationDefinition.via.service
            });

            // add the oroginal selection as child
            selection.children.push(relationalSelection);


            const intermediateRelationDefinition = this.getRelation(relationDefinition.via.service, relationDefinition.via.resource);

            return this.loadRelationalRecords(intermediateRelationDefinition, selection, records, originRequest).then((results) => {

                // create a map for the input records
                const recordMap = new Map();
                records.forEach(r => recordMap.set(r[relationDefinition.property], r));


                // assign the results
                results.forEach((resultRecord) => {
                    if (recordMap.has(resultRecord[relationDefinition.via.localProperty])) {
                        const localRecord = recordMap.get(resultRecord[relationDefinition.via.localProperty]);

                        if (!localRecord[relationDefinition.name]) localRecord[relationDefinition.name] = [];

                        if (resultRecord[relationDefinition.name]) localRecord[relationDefinition.name].push(resultRecord[relationDefinition.name]);
                        else {
                            localRecord[relationDefinition.name].push({
                                  status: 'error'
                                , code: 'remote_loading_error'
                                , message: `Failed to load remote record from ${relationDefinition.remote.service}/${relationDefinition.remote.resource}. The record doesn't exist on the remote resource!`
                            });
                        }
                    }
                });

                return Promise.resolve();
            });
        }









        loadRelationalRecords(relationDefinition, relationalSelection, records, originRequest) {

            // collect ids
            const ids = Array.from(new Set(type.object(records) ? [records[relationDefinition.property]] : records.map(r => r[relationDefinition.property]))).filter(id => id !== null);

            // create a filter for their end
            let filter = new FilterBuilder();

            // add any existing filters
            if (relationalSelection.hasFilter()) filter = filter.and().addChild(relationalSelection.filter);

            // add our filter
            filter.property(relationDefinition.remote.property).comparator('in').value(ids);

            // make sure to select the filtered column
            const selection = relationalSelection.selection.slice(0);
            selection.push(relationDefinition.remote.property);

            // get the relation
            return new RelationalRequest({
                  resource              : relationDefinition.remote.resource
                , service               : relationDefinition.remote.service
                , filter                : filter
                , service               : relationDefinition.remote.service
                , selection             : selection
                , relationalSelection   : relationalSelection.getSubselectionMap()
                , languages             : relationalSelection.languages
                , tokens                : relationalSelection.tokens
                , action                : 'list'
                , origin                : originRequest
            }).send(this).then((response) => {
                if (response.status === 'ok') {
                    return Promise.resolve(response.data);
                } else return Promise.reject(response.toError());
            }).catch(err => Promise.reject(new Error(`Failed to load referenced relational selection ${relationDefinition.remote.resource}: ${err.message}`)));
        }







        /**
        * make sure foreign keys are selected for references that must eb loaded
        */
        prepareSelection(request) {
            if (request.relationalSelection) {
                for (const relationalSelection of request.relationalSelection.values()) {
                    const relationDefinition = this.getRelation(relationalSelection.service, relationalSelection.resource);

                    if (relationDefinition && relationDefinition.type === 'reference') {
                        request.selection.push(relationDefinition.property);
                    }
                }
            }
        }







        getFilterValue(filter, resourceName, propertyName, filterName, parentResourceName, parentPropertyName) {
            if (filter) {
                if (filter.type === 'entity') parentResourceName = filter.entityName;
                if (filter.type === 'property') parentPropertyName = filter.propertyName;


                if ((!parentResourceName || parentResourceName === resourceName) && parentPropertyName === propertyName && (filter.type === 'function' || filter.type === 'comparator')) {
                    //log.warn(filter.type, filter.children.length, resourceName, propertyName, parentResourceName, parentPropertyName);
                    if (filter.type === 'function') return filter.children.map(item => item.nodeValue);
                    else {
                        if (filter.children[0].type === 'function') return filter.children[0].children.map(item => item.nodeValue);
                        else return filter.children[0].nodeValue;
                    }
                } else {
                    const results = filter.children.map(child => this.getFilterValue(child, resourceName, propertyName, filterName, parentResourceName, parentPropertyName)).filter(v => !!v);

                    if (results.length) return results[0];
                    else return undefined;
                }
            }
        }





        updateFilterProperty(request, instruction) {
            if (request.filter) this.updateFilterPropertyExecutor(request.filter, instruction);
        }

        updateFilterPropertyExecutor(filter, instruction, parentResource) {
            if ((parentResource && parentResource.entityName === instruction.from.resource || !parentResource) && filter.type === 'property' && filter.propertyName === instruction.from.property) {
                // hit, change
                if (parentResource) parentResource.entityName = instruction.to.resource;
                filter.propertyName = instruction.to.property;
            }

            if (filter.type === 'entity') parentResource = filter;

            filter.children.forEach((child) => {
                this.updateFilterPropertyExecutor(child, instruction, parentResource);
            });
        }







        /**
        * get all filternodes that match the properties passed to this method
        */
        findFilterNodes(filter, {resource, property, comparator, value} = {}) {
            const results = [];

            if (filter) this.findFilterNode({filter, resource, property, comparator, value}, 'resource', results);

            return results;
        }





        /**
        * find a filter node by its properties
        */
        findFilterNode({filter, resource, property, comparator, value}, matchLevel, results) {

            // the resource is optional
            if (matchLevel === 'resource' && !resource) matchLevel = 'property';

            // the property is optional too
            if (matchLevel === 'property' && !property) matchLevel = 'comparator';

            // the comparator is optional too
            if (matchLevel === 'comparator' && !comparator) matchLevel = 'value';



            if (filter.type === matchLevel) {
                switch (matchLevel) {
                    case 'resource':
                        if (filter.entityName === resource) filter.children.forEach(filter => this.findFilterNode({filter, resource, property, comparator, value}, 'property', results));
                        return;

                    case 'property':
                        if (filter.propertyName === property) {
                            if (comparator === undefined) {
                                if (value === undefined) results.push(filter);
                                else filter.children.forEach(filter => this.findFilterNode({filter, resource, property, comparator, value}, 'comparator', results));
                            } else filter.children.forEach(filter => this.findFilterNode({filter, resource, property, comparator, value}, 'comparator', results));
                        }
                        return;

                    case 'comparator':
                        if (comparator === undefined) {
                            if (value === undefined) results.push(filter);
                            else filter.children.forEach(filter => this.findFilterNode({filter, resource, property, comparator, value}, 'value', results));
                        } else if (filter.comparator === comparator) filter.children.forEach(filter => this.findFilterNode({filter, resource, property, comparator, value}, 'value', results));
                        return;

                    case 'value':
                        if (value === undefined || filter.nodeValue === value) results.push(value);
                        return;

                }
            } else filter.children.forEach(filter => this.findFilterNode({filter, resource, property, comparator, value}, matchLevel, results));
        }






        combineRemoteRecords(definition, localRecords, remoteRecords) {

            if (remoteRecords && remoteRecords.length) {
                const map = new Map();

                if (definition.type === 'reference') {
                    remoteRecords.forEach((record) => {
                        map.set(record[definition.remote.property], record);
                    });
                } else if (definition.type === 'belongsTo') {
                    remoteRecords.forEach((record) => {
                        if (!map.has(record[definition.remote.property])) map.set(record[definition.remote.property], []);
                        map.get(record[definition.remote.property]).push(record);

                        // remove our id for prvaciy reasons
                        delete record[definition.remote.property];
                    });
                }


                localRecords.forEach((localRecord) => {
                    const ourId = localRecord[definition.property];
                    if (ourId && map.has(ourId)) localRecord[definition.name] = map.get(ourId);
                });
            }
        }






        hasRelation(service, name, type) {
            return this.relations.has(service) &&
                this.relations.get(service).has(name) &&
                (!type || this.relations.get(service).get(name).type === type);
        }



        getRelation(service, name) {
            if (this.hasRelation(service, name)) return this.relations.get(service).get(name);
            else throw new Error(`Cannot get definition for relation ${service}/${name}. The relation does not exist on the resource ${this.getServiceName()}/${this.getName()}!`);
        }



        storeRelation(service, name, definition) {

            // store per service
            if (!this.relations.has(service)) this.relations.set(service, new Map());
            const relations = this.relations.get(service);

            // dont do double registrations
            if (relations.has(name)) throw new Error(`Cannot register reference ${name} on the resource ${this.getName()}, it was already registered before as a ${relations.get(name).type}!`);

            // store
            relations.set(name, definition);
        }








        registerReference(name, definition) {
            if (!type.string(name) || !name.length) throw new Error(`Cannot register reference. Name is missing!`);
            if (!type.object(definition)) throw new  Error(`Cannot register reference ${name} on the resource ${this.name}, the definition is missing!`);
            if (!type.string(definition.property) || !definition.property.length) throw new Error(`Cannot register reference ${name} on the resource ${this.name}: missing or invalid 'property' property on the definition!`);
            if (!type.object(definition.remote)) throw new Error(`Cannot register reference ${name} on the resource ${this.name}: missing or invalid 'remote' property on the definition!`);
            if (!type.string(definition.remote.service) || !definition.remote.service.length) throw new Error(`Cannot register reference ${name} on the resource ${this.name}: missing or invalid 'remote.service' property on the definition!`);
            if (!type.string(definition.remote.resource) || !definition.remote.resource.length) throw new Error(`Cannot register reference ${name} on the resource ${this.name}: missing or invalid 'remote.resource' property on the definition!`);
            if (!type.string(definition.remote.property) || !definition.remote.property.length) throw new Error(`Cannot register reference ${name} on the resource ${this.name}: missing or invalid 'remote.property' property on the definition!`);


            this.storeRelation(definition.remote.service, name, {
                  name          : name
                , type          : 'reference'
                , property      : definition.property
                , remote: {
                      resource      : definition.remote.resource
                    , property      : definition.remote.property
                    , service       : definition.remote.service
                }
            });

            this.referencingKeys.set(definition.property, name);
        }







        registerBelongsTo(name, definition) {
            if (!type.string(name) || !name.length) throw new Error(`Cannot register belongs to. Name is missing!`);
            if (!type.object(definition)) throw new  Error(`Cannot register belongs to ${name} on the resource ${this.name}, the definition is missing!`);
            if (!type.string(definition.property) || !definition.property.length) throw new Error(`Cannot register belongs to ${name} on the resource ${this.name}: missing or invalid 'property' property on the definition!`);
            if (!type.object(definition.remote)) throw new Error(`Cannot register belongs to ${name} on the resource ${this.name}: missing or invalid 'remote' property on the definition!`);
            if (!type.string(definition.remote.service) || !definition.remote.service.length) throw new Error(`Cannot register belongs to ${name} on the resource ${this.name}: missing or invalid 'remote.service' property on the definition!`);
            if (!type.string(definition.remote.resource) || !definition.remote.resource.length) throw new Error(`Cannot register belongs to ${name} on the resource ${this.name}: missing or invalid 'remote.resource' property on the definition!`);
            if (!type.string(definition.remote.property) || !definition.remote.property.length) throw new Error(`Cannot register belongs to ${name} on the resource ${this.name}: missing or invalid 'remote.property' property on the definition!`);



            this.storeRelation(definition.remote.service, name, {
                  name          : name
                , type          : 'belongsTo'
                , property      : definition.property
                , remote: {
                      resource      : definition.remote.resource
                    , property      : definition.remote.property
                    , service       : definition.remote.service
                }
            });
        }







        registerMapping(name, definition) {
            if (!type.string(name) || !name.length) throw new Error(`Cannot register mapping. Name is missing!`);
            if (!type.object(definition)) throw new  Error(`Cannot register mapping ${name} on the resource ${this.name}, the definition is missing!`);
            if (!type.string(definition.property) || !definition.property.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'property' property on the definition!`);
            if (!type.object(definition.remote)) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'remote' property on the definition!`);
            if (!type.string(definition.remote.service) || !definition.remote.service.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'remote.service' property on the definition!`);
            if (!type.string(definition.remote.resource) || !definition.remote.resource.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'remote.resource' property on the definition!`);
            if (!type.string(definition.remote.property) || !definition.remote.property.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'remote.property' property on the definition!`);
            if (!type.object(definition.via)) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'via' property on the definition!`);
            if (!type.string(definition.via.service) || !definition.via.service.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'via.service' property on the definition!`);
            if (!type.string(definition.via.resource) || !definition.via.resource.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'via.resource' property on the definition!`);
            if (!type.string(definition.via.localProperty) || !definition.via.localProperty.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'via.localProperty' property on the definition!`);
            if (!type.string(definition.via.remoteProperty) || !definition.via.remoteProperty.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'via.remoteProperty' property on the definition!`);
            if (!type.string(definition.via.alias) || !definition.via.alias.length) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}: missing or invalid 'via.alias' property on the definition!`);



            this.storeRelation(definition.remote.service, name, {
                  name          : name
                , type          : 'mapping'
                , property      : definition.property
                , remote: {
                      resource      : definition.remote.resource
                    , property      : definition.remote.property
                    , service       : definition.remote.service
                }
                , via: {
                      resource      : definition.via.resource
                    , localProperty : definition.via.localProperty
                    , remoteProperty: definition.via.remoteProperty
                    , service       : definition.via.service
                    , alias         : definition.via.alias
                }
            });
        }





        removeReferenceIds(data, requestingResource, selection) {
            if (type.array(data)) data.forEach((d) => this.removeReferenceIds(d, requestingResource, selection));
            else if (type.object(data)) {
                Object.keys(data).forEach((key) => {
                    if (this.referencingKeys.has(key)) {
                        
                        // dont delete keys that are required by the requester, they
                        // will delete it tehemselves. dont remove primaries
                        if (this.referencingKeys.get(key) !== requestingResource && !this.definition.properties.get(key).isPrimary && (!selection || !selection.includes(key))) delete data[key];
                    }
                });
            }
        }
    };
})();
