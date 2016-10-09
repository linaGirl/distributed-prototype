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
                };

                // ammend the filter, send off to the list method
                this.applyListOneFilter(request);


                // get no more than one
                request.limit = 1;

                return this.list(request, response, permissions);
            }
        }

        applyListOneFilter(request) {
            const originalFilter = request.filter;
            request.filter = new FilterBuilder();
            request.filter.and()
                    .addChild(originalFilter)
                    .property(this.definition.primaryId)
                    .comparator('=')
                    .value(request.resourceId);
        }











        resolveRelations(data) {


            // if a property of the data is an object and
            // it's a reference we should resolve it and
            // replace it by the referenced resources id
            if (type.object(data)) {
                return Promise.all(Object.keys(data).map((propertyName) => {
                    if (type.object(data[propertyName]) || type.array(data[propertyName])) {
                        if (this.relations.has(propertyName)) {
                            const relationDefinition = this.relations.get(propertyName);

                            if (relationDefinition.type === 'reference' && type.object(data[propertyName])) {
                                const filter = new FilterBuilder();
                                const andFilter = filter.and();

                                Object.keys(data[propertyName]).forEach((key) => {
                                    andFilter.property(key).comparator('=').value(data[propertyName][key]);
                                });

                                return new RelationalRequest({
                                      resource  : relationDefinition.remote.resource
                                    , filter    : filter
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
                }))
            } else return Promise.resolve();
        }







        loadRelationanlSelections(request, records) {

            // no need to load data if there is no data
            // locally
            if (!records || (type.array(records) && !records.length)) return Promise.resolve();

            // check if there are any related resources
            // requested
            if (request.hasRelationalSelection()) {
                const selection = request.getRelationalSelection();

                return Promise.all(Array.from(selection.keys()).map((relationalSelectionName) => {
                    return this.loadRelationalSelection(records, selection.get(relationalSelectionName));
                })).then(() => records);
            } else return Promise.resolve();
        }







        loadRelationalSelection(records, relationalSelection) {
            if (!this.relations.has(relationalSelection.resource)) return Promise.reject(new Error(`The relation ${relationalSelection.resource} does not exist!`));
            else {
                const relationDefinition = this.relations.get(relationalSelection.resource);


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
            });

            // add the oroginal selection as child
            selection.children.push(relationalSelection);


            return this.loadRelationalRecords(this.relations.get(relationDefinition.via.resource), selection, records).then((results) => {

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
                  resource  : relationDefinition.remote.resource
                , filter    : filter
                , selection : relationalSelection.selection
                , relationalSelection: relationalSelection.getSubselectionMap()
                , languages : relationalSelection.languages
                , action    : 'list'
            }).send(this).then((response) => {
                if (response.status === 'ok') {
                    return Promise.resolve(response.data);
                } else return Promise.reject(new Error(`expected status ok, got ${response.status} instead!`));
            }).catch(err => Promise.reject(new Error(`Failed to load referenced relational selection ${relationDefinition.remote.resource}: ${err.message}`)));
        }










        combineRemoteRecords(definition, localRecords, remoteRecords) {
            if (remoteRecords && remoteRecords.length) {
                const map = new Map();

                if (definition.type === 'reference') {
                    if (type.object(localRecords)) return localRecords[definition.remote.resource] = remoteRecords[0];
                    else {
                        remoteRecords.forEach((record) => {
                            map.set(record[definition.remote.property], record);
                        });
                    }
                } else if (definition.type === 'belongsTo') {
                    if (type.object(localRecords)) return localRecords[definition.remote.resource] = remoteRecords;
                    else {
                        remoteRecords.forEach((record) => {
                            if (!map.has(record[definition.remote.property])) map.set(record[definition.remote.property], []);
                            map.get(record[definition.remote.property]).push(record);

                            // remove our id for prvaciy reasons
                            delete record[definition.remote.property];
                        });
                    }
                }


                localRecords.forEach((localRecord) => {
                    const ourId = localRecord[definition.property];
                    if (ourId && map.has(ourId)) localRecord[definition.name] = map.get(ourId);
                });
            }
        }












        registerReference(name, options) {
            if (this.relations.has(name)) throw new Error(`Cannot register reference ${name} on the resource ${this.name}, it was already registered before as a ${this.relations.get(name).type}!`);

            this.relations.set(name, {
                  name: name
                , type: 'reference'
                , property: options.localProperty
                , remote: {
                      resource: options.remoteResource
                    , property: options.remoteResourceProperty
                }
            });

            this.referencingKeys.set(options.localProperty, name);
        }







        registerBelongsTo(name, options) {
            if (this.relations.has(name)) throw new Error(`Cannot register belongs to ${name} on the resource ${this.name}, it was already registered before as a ${this.relations.get(name).type}!`);

            this.relations.set(name, {
                  name: name
                , type: 'belongsTo'
                , property: options.localProperty
                , remote: {
                      resource: options.remoteResource
                    , property: options.remoteResourceProperty
                }
            });
        }







        registerMapping(name, options) {
            if (this.relations.has(name)) throw new Error(`Cannot register mapping ${name} on the resource ${this.name}, it was already registered before as a ${this.relations.get(name).type}!`);

            this.relations.set(name, {
                  name: name
                , type: 'mapping'
                , property: options.localProperty
                , remote: {
                      resource: options.remoteResource
                    , property: options.remoteResourceProperty
                }
                , via: {
                      resource: options.viaResource
                    , localProperty: options.viaResourceLocalProperty
                    , remoteProperty: options.viaResourceRemoteProperty
                    , alias: options.viaAlias
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
