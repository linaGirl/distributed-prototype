(function() {
    'use strict';


    const ResourceController = require('./ResourceController');
    const RelationalResourceDefinition = require('./RelationalResourceDefinition');
    const RelationalRequest = require('./RelationalRequest');
    const FilterBuilder = require('./FilterBuilder');
    const RelationalSelection = require('./RelationalSelection');
    const type = require('ee-types');
    const log = require('ee-log');






    module.exports = class RelationalResourceController extends ResourceController {


        constructor(name) {
            super(name);
            this.relations = new Map();
            this.definition = new RelationalResourceDefinition({name: name});

            // storage for the referencing keys registered on this resource
            this.referencingKeys = new Map();
        }




        enableActions() {
            this.enableAction('listOne');
            this.enableAction('createOne');
            this.enableAction('deleteOne');
            this.enableAction('updateOne');
            this.enableAction('registerRelation');
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









        createOne(request, response, permissions) {
            request.data = [request.data];

            // remove array on the response
            response.onBeforeSend = () => {
                if (response.data && type.array(response.data.id)) response.data.id = response.data.id[0];
            };

            return this.create(request, response, permissions);
        }







        deleteOne(request, response, permissions) {
            if (!this.definition.hasPrimaryId()) return response.error('no_primary_id', `the resource has no or multiple primary ids and can only be deleted using the delete action!`);
            else {


                // ammend the filter, send off to the list method
                this.applyDeleteOneFilter(request);


                // get no more than one
                request.limit = 1;


                return this.delete(request, response, permissions);
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









        updateOne(request, response, permissions) {
            if (!this.definition.hasPrimaryId()) return response.error('no_primary_id', `the resource has no or multiple primary ids and can only be deleted using the update action!`);
            else {

                // remove array in response
                response.onBeforeSend = () => {
                    if (response.data && response.data.id && response.data.id.length) response.data.id = response.data.id[0];
                };

                // ammend the filter, send off to the list method
                this.applyUpdateOneFilter(request);


                // get no more than one
                request.limit = 1;


                return this.update(request, response, permissions);
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









        listOne(request, response, permissions) {
            if (!this.definition.hasPrimaryId()) return response.error('no_primary_id', `the resource has no or multiple primary ids and can only be fetched using the list action!`);
            else {

                // remove array on the response
                response.onBeforeSend = () => {
                    if (response.data && response.data.length) response.data = response.data[0];
                    else {
                        response.status = 'notFound';
                        response.data = undefined;
                        response.message = `Could not load the ${this.getServiceName()}/${this.getName()} with the key ${request.resourceId}!`;
                    }
                };

                // ammend the filter, send off to the list method
                this.applyListOneFilter(request);


                // get no more than one
                request.limit = 1;

                return this.list(request, response, permissions);
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
                        else return Promise.reject(new Error(`The registration of the remote relation ${definition.name} failed with the status ${response.status}: ${response.message}`));
                    });
                }
            };

            return register();
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
                                        andFilter.property(key).comparator('=').value(data[propertyName][key]);
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
                                        } else return Promise.reject(new Error(`expected status ok, got ${response.status} instead!`));
                                    }).catch(err => Promise.reject(new Error(`Failed to load referenced relational selection ${relationDefinition.remote.resource}: ${err.message}`)));
                                } else if ((relationDefinition.type === 'mapping' || relationDefinition.type === 'belongsTo') && type.array(data[propertyName])) {
                                    const filter = new FilterBuilder();
                                    const orFilter = filter.or();

                                    data[propertyName].forEach((relation) => {
                                        const andFilter = orFilter.and();

                                        Object.keys(relation).forEach((key) => {
                                            andFilter.property(key).comparator('=').value(relation[key]);
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
                                        } else return Promise.reject(new Error(`expected status ok, got ${response.status} instead!`));
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
                    return this.loadRelationalSelection(records, selection.get(relationalSelectionName));
                })).then(() => Promise.resolve(records));
            } else return Promise.resolve();
        }







        loadRelationalSelection(records, relationalSelection) {
            if (!this.hasRelation(relationalSelection.service, relationalSelection.resource)) return Promise.reject(new Error(`The relation ${relationalSelection.service}/${relationalSelection.resource} does not exist!`));
            else {
                const relationDefinition = this.getRelation(relationalSelection.service, relationalSelection.resource);


                if (relationDefinition.type === 'reference' || relationDefinition.type === 'belongsTo') {
                    return this.loadRelationalRecords(relationDefinition, relationalSelection, records).then(((results) => {
                        this.combineRemoteRecords(relationDefinition, records, results);
                        return Promise.resolve(records);
                    }));
                }
                else if (relationDefinition.type === 'mapping') return this.loadRelationalMapping(relationDefinition, relationalSelection, records);
                else return Promise.reject(`The relation ${relationDefinition.name} has an invalif type ${relationDefinition.type}!`);
            }
        }







        loadRelationalMapping(relationDefinition, relationalSelection, records) {

            // select the mapping table
            const selection = new RelationalSelection({
                  resource: relationDefinition.via.resource
                , selection: [relationDefinition.via.localProperty]
                , service: relationDefinition.via.service
            });

            // add the oroginal selection as child
            selection.children.push(relationalSelection);


            return this.loadRelationalRecords(this.getRelation(relationDefinition.via.service, relationDefinition.via.resource), selection, records).then((results) => {

                // create a mpa for the input rtecords
                const recordMap = new Map();
                records.forEach(r => recordMap.set(r[relationDefinition.property], r));


                // assign the results
                results.forEach((resultRecord) => {
                    if (recordMap.has(resultRecord[relationDefinition.via.localProperty])) {
                        const localRecord = recordMap.get(resultRecord[relationDefinition.via.localProperty]);

                        if (!localRecord[relationDefinition.name]) localRecord[relationDefinition.name] = [];
                        localRecord[relationDefinition.name].push(resultRecord[relationDefinition.name]);
                    }
                });

                return Promise.resolve();
            });
        }









        loadRelationalRecords(relationDefinition, relationalSelection, records) {

            // collect ids
            const ids = Array.from(new Set(type.object(records) ? [records[relationDefinition.property]] : records.map(r => r[relationDefinition.property]))).filter(id => id !== null);

            // create a filter for their end
            let filter = new FilterBuilder();

            // add any existing filters
            if (relationalSelection.hasFilter()) filter = filter.and().addChild(relationalSelection.filter);

            // add our filter
            filter.property(relationDefinition.remote.property).comparator('in').value(ids);

            // get the relation
            return new RelationalRequest({
                  resource              : relationDefinition.remote.resource
                , service               : relationDefinition.remote.service
                , filter                : filter
                , service               : relationDefinition.remote.service
                , selection             : relationalSelection.selection
                , relationalSelection   : relationalSelection.getSubselectionMap()
                , languages             : relationalSelection.languages
                , tokens                : relationalSelection.tokens
                , action                : 'list'
            }).send(this).then((response) => {
                if (response.status === 'ok') {
                    return Promise.resolve(response.data);
                } else return Promise.reject(new Error(`expected status ok, got ${response.status} instead!`));
            }).catch(err => Promise.reject(new Error(`Failed to load referenced relational selection ${relationDefinition.remote.resource}: ${err.message}`)));
        }





        getFilterValue(filter, resourceName, propertyName, filterName, parentResourceName, parentPropertyName) {
            if (filter.type === 'entity') parentResourceName = filter.entityName;
            if (filter.type === 'property') parentPropertyName = filter.propertyName;


            if ((!parentResourceName || parentResourceName === resourceName) &&
                parentPropertyName === propertyName &&
                filter.type === 'function' || filter.type === 'comparator') {
                return filter.children.map(item => item.nodeValue);
            } else {
                const results = filter.children.map(child => this.getFilterValue(child, resourceName, propertyName, filterName, parentResourceName, parentPropertyName)).filter(v => !!v);

                if (results.length) return results[0];
                else return undefined;
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





        removeReferenceIds(data, requestingResource) {
            if (type.array(data)) data.forEach((d) => this.removeReferenceIds(d, requestingResource));
            else if (type.object(data)) {
                Object.keys(data).forEach((key) => {
                    if (this.referencingKeys.has(key)) {
                        // dont delete keys that are required by the requester, they
                        // will delete it tehemselves. dont remove primaries
                        if (this.referencingKeys.get(key) !== requestingResource && !this.definition.properties.get(key).isPrimary) delete data[key];
                    }
                });
            }
        }
    };
})();
