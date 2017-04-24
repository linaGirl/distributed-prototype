(function() {
    'use strict';


    const log = require('ee-log');
    const type = require('ee-types');
    const RPCRequest = require('ee-soa-rpc-request');
    const RelationalRequest = require('./RelationalRequest');
    const RelationalResponse = require('./RelationalResponse');
    const FilterBuilder = require('./FilterBuilder');
    const RelationalSelection = require('./RelationalSelection');




    const simpleComparators = new Set();
    simpleComparators.add('=');
    simpleComparators.add('!=');
    simpleComparators.add('>');
    simpleComparators.add('>=');
    simpleComparators.add('<');
    simpleComparators.add('<=');



    const statusCodeMap = new Map();
    statusCodeMap.set('ok', 1);
    statusCodeMap.set('created', 2);
    statusCodeMap.set('notFound', 26);
    statusCodeMap.set('error', 37);
    statusCodeMap.set('invalidAction', 27);
    statusCodeMap.set('badRequest', 23);
    statusCodeMap.set('serviceUnavailable', 38);
    statusCodeMap.set('forbidden    ', 25);
    statusCodeMap.set('authorizationRequired', 24);
    statusCodeMap.set('conflict', 80);
    statusCodeMap.set('noContent', 204);
    statusCodeMap.set('accepted', 202);
    statusCodeMap.set('seeOther', 303);


    const methodMap = new Map();
    methodMap.set('list', 'GET');
    methodMap.set('listOne', 'GET');
    methodMap.set('create', 'POST');
    methodMap.set('createOne', 'POST');
    methodMap.set('update', 'PATCH');
    methodMap.set('updateOne', 'PATCH');
    methodMap.set('createOrUpdate', 'PUT');
    methodMap.set('createOrUpdateOne', 'PUT');
    methodMap.set('delete', 'DELETE');
    methodMap.set('deleteOne', 'DELETE');


    const debug = process.argv.indexOf('debug-service') >= 0 || process.env.debugService;



    module.exports = class LegacyRequestTranslator {


        constructor() {

            // needed to convert to legacy
            this.RPCRequest = new RPCRequest(this);
        }






        fromLegacy(legacyRequest, legacyResponse) {
            let request, response;


            try {
                request = this.convertIncomingRequest(legacyRequest);
                response = this.convertIncomingResponse(legacyResponse, request);
            } catch (err) {
                if (debug) log(err);
                legacyResponse.send(37, `Failed to translate legacy to distributed request: ${err.message}`);
                return Promise.reject(err);
            }

            return Promise.resolve({
                  request  : request
                , response : response
            });
        }







        toLegacy(request, response) {
            let url = '/';
            let range;

            // add service if not explicitly legacy is addressed
            url += request.getService() === 'legacy' ? '' : request.getService()+'.';

            // add the resource
            url += `${request.resource}`;

            // add the id if present
            if (request.hasResourceId()) url += `/${request.getResourceId()}`;


            // add remote service if not explicitly legacy is addressed
            if (request.hasRemoteService()) url += request.getRemoteService() === 'legacy' ? '' : request.getRemoteService()+'.';

            // add the resource
            if (request.hasRemoteResource()) url += `/${request.getRemoteResource()}`;

            // add the id if present
            if (request.hasRemoteResourceId()) url += `/${request.getRemoteResourceId()}`;


            // offset
            if (type.number(request.offset)) {
                if (type.number(request.limit)) range = `${request.offset}-${request.offset+request.limit}`;
                else range = `${request.offset}-${request.offset+100}`;
            } else if (type.number(request.limit)) range = `0-${request.offset+request.limit}`;


            return new this.RPCRequest({
                  filter        : this.convertToLegacyFilter(request.filter)
                , select        : this.convertToLegaySelection(request)
                , languages     : request.languages
                , data          : request.data
                , url           : url
                , method        : methodMap.get(request.action)
                , range         : range
                , order         : (request.order || []).join(', ')
                , accessTokens  : request.tokens
            }).convert().then((result) => {// log(result);



                // so, the subrequest shev no range on them, fix that
                // not nice, but should work somehow
                const fixRange = (request) => {
                    if (request && request.subRequests && request.subRequests.length) {
                        request.subRequests.forEach((subRequest) => {
                            subRequest.range = {
                                  from: 0
                                , to: 2000
                            }

                            fixRange(subRequest);
                        });
                    }
                };

                fixRange(result.request);



                if (request.hasOption('legacyProperties')) {

                    // set stuff directly on the legacy request object
                    const properties = request.getOoption('legacyProperties');
                    if (type.object(properties)) {
                        const keys = Object.keye(properties);
                        for (key in keys) {
                            try {
                                result.request[key] = properties[key];
                            } catch (err) {
                                return Promise.reject(new Error(`Failed to set the property ${key} on the legacy request object!`));
                            };
                        };
                    }
                }


                // get results
                result.response.on('end', (status, data) => {
                    response.data = data;

                    // check if there is somebody settnig cookies, 
                    // move them to the options object
                    const keys = Object.keys(result.response.headers).map(key => ({
                          key: key
                        , id: key.toLowerCase().trim()
                    })).filter(o => o.id === 'set-cookie');

                    keys.forEach((key) => {
                        const value = result.response.headers[key.key];

                        // parse cookie
                        const parts = /\s*([^=]+)=([^;]+)/gi.exec(value);
                        if (parts) {
                            if (!response.cookies) response.cookies = {};
                            response.cookies[parts[1].trim()] = parts[2].trim();
                        }
                    });



                    switch (status) {
                        case 1:     return response.ok(data);
                        case 2:     return response.created(data.id);
                        case 202:   return response.accepted(data.id);
                        case 204:   return response.noContent(data.id);
                        case 303:   return response.seeOther(data.id);
                        case 26:    return response.notFound(`The requested resource was not found!`);
                        case 80:    return response.conflict(`There was a conflict on the requested resource!`);
                        case 23:    return response.badRequest('legacy_error', `The request was malformed!`);
                        case 24:    return response.forbidden('forbidden', `You are not allowed to access the resource!`);
                        case 25:    return response.authorizationRequired('unknown', result.reques.getAction());
                        case 27:    return response.invalidAction(`The action ${result.request.getAction()} was not implemetned on the resource!`);
                        case 32:
                            const rlHeader = result.response.getHeader('Rate-Limit');
                            const rlLeft = result.response.getHeader('Rate-Limit-Balance');
                            let limits;

                            if (rlHeader && rlHeader.length) limits = /(\d+)\/(\d+)s/.exec(rlHeader);

                            return response.tooManyRequests(limits ? parseInt(limits[2], 10) : 60, limits ? parseInt(limits[1], 10) : 0, parseInt(rlLeft ? rlLeft+'' : 0, 10));
                        case 37: return response.error('legacy_error', `The legacy layer returned an error (${methodMap.get(request.action)} on ${url}${request.requestingService ? ` issued by the ${request.requestingService} service` : ''})!`, (data.err || new Error(data.msg)));
                        default: return response.error('legacy_error', `The legacy layer returned an unknown status ${status}!`, (data.err || new Error(data.msg)));
                    }
                });

                return Promise.resolve(result);
            }).catch((err) => {
                if (debug) log(err);
                response.error('legacy_error', `The legacy layer failed to convert the request`, err);
                return Promise.reject(err);
            });
        }










        convertToLegaySelection(request) {
            const selects = new Set(request.selection || []);
            const children = [];
            const selection = request.getRelationalSelection();

            if (selection) {
                for (const value of selection.values()) children.push(value);
                if (request.hasRelationalSelection()) this.convertToLegayRelationalSelection({children: children}, selects, '');
            }

            return selects.size ? Array.from(selects).join(', ') : '';
        }



        convertToLegayRelationalSelection(selection, selects, path) {
            if (selection.children) {
                selection.children.forEach((childSelection) => {
                    if (childSelection.hasFilter()) throw new Error(`Cannot convert subrequests with filters!`);
                    if (childSelection.hasSelection()) childSelection.selection.forEach(s => selects.add(`${path}${(path.length ? '.' : '')}${childSelection.resource}.${s}`));
                    this.convertToLegayRelationalSelection(childSelection, selects, `${path}${(path.length ? '.' : '')}${childSelection.resource}`);
                });
            }
        }






        convertToLegacyFilter(filter) {
            if (filter) {
                switch(filter.type) {

                    case 'or':
                        throw new Error(`Cannot convert or filter to legacy format!`);



                    case 'and':
                    case 'root':
                        if (filter.children.length >= 1) {
                            const andChildren = [];
                            filter.children.forEach(child => andChildren.push(this.convertToLegacyFilter(child)));
                            return andChildren.join(', ');
                        }
                        else return null;


                    case 'entity':
                        if (filter.children.length >= 1) {
                            const children = [];
                            filter.children.forEach(child => children.push(`${filter.entityName}.${this.convertToLegacyFilter(child)}`));
                            return children.join(', ');
                        }
                        else return null;



                    case 'property':
                        if (filter.children.length === 0) return null;
                        else if (filter.children.length > 1) throw new Error(`Cannot build property filter with more than on child!`);
                        else return `${filter.propertyName}${this.convertToLegacyFilter(filter.children[0])}`;



                    case 'comparator':
                        if (filter.children.length === 0) return null;
                        else if (filter.children.length > 1) throw new Error(`Cannot build comparator filter with more than on child!`);
                        else {
                            if (simpleComparators.has(filter.comparator)) return `${filter.comparator}${this.convertToLegacyFilter(filter.children[0])}`;
                            else {
                                // a function filter
                                let filterString = '';

                                // add the equal comparator if not already set as parent
                                if (filter.parent.type !== 'comparator') filterString += '=';

                                // get the filters contents
                                filterString += `${filter.comparator}(${this.convertToLegacyFilter(filter.children[0])})`;

                                return filterString;
                            }
                        }


                    case 'function':
                        if (filter.children.length === 0) return null;
                        else {
                            const results = filter.children.map(child => this.convertToLegacyFilter(child));
                            return `${filter.functionName}(${results.join(',')})`;
                        }



                    case 'value':
                        return isNaN(filter.nodeValue+'') ? `'${filter.nodeValue}'` : filter.nodeValue+'';
                }
            }
        }


        getEntityPath(filter) {
            let currentNode = '';
            if (filter.type === 'entity') currentNode = filter.entityName;
            else if (filter.type === 'property') currentNode = filter.propertyName;

            if (filter.parent) {
                const parentPath = this.getEntityPath(filter.parent);
                if (parentPath.length) return `${parentPath}${(parentPath[parentPath.length -1] === '.' ? '' : '.')}${currentNode}`;
                else return currentNode;
            }
            else return currentNode;
        }









        convertIncomingResponse(legacyResponse, request) {
            const response = new RelationalResponse();
            let errorData;


            response.onSend = () => {
                if (debug) {
                    log.info(`response: status -> ${response.status}, message -> ${response.message}`);
                    if (response.err) log(err);
                }


                // pass the rate limit meta as headers to the outside
                if (response.hasMetaData('rate-limit-interval')) legacyResponse.setHeader('Rate-Limit', `${response.getMetaData('rate-limit-credits')}/${response.getMetaData('rate-limit-interval')}s`);
                if (response.hasMetaData('rate-limit-cost')) legacyResponse.setHeader('Rate-Limit-Cost', response.getMetaData('rate-limit-cost'));
                if (response.hasMetaData('rate-limit-value')) legacyResponse.setHeader('Rate-Limit-Balance', response.getMetaData('rate-limit-value'));



                switch(response.status) {
                    case 'created':
                    case 'seeOther':
                    case 'accepted':
                    case 'noContent':
                        legacyResponse.setHeader('Location', `/${response.data.serviceName}.${response.data.resourceName}/${response.data.id}`);
                        break;

                    case 'invalidAction':
                    case 'notFound':
                        errorData = response.toError().message; //`Failed to execute the ${request.action} action on ${request.service}/${request.resource}: ${response.message}`
                        break;

                    case 'badRequest':
                    case 'serviceUnavailable':
                    case 'forbidden':
                        errorData = response.toError().message; //`Failed to execute the ${request.action} action on ${request.service}/${request.resource}: ${response.message} (${response.code})`
                        break;

                    case 'error':
                        errorData = response.toError().message; //`Failed to execute the ${request.action} action on ${request.service}/${request.resource}: ${response.message} (${response.code}) ${response.err ? ' ('+response.err.message+')' : ''}`
                        break;
                }

                // check for a valid response code
                if (!statusCodeMap.has(response.status)) {
                    errorData = `Failed to translate the response status '${response.status}'' into a valid legacy statuscode on a request on ${request.action} ${request.service}/${request.resource}!`;
                    response.status = 'error';
                }


                process.nextTick(() => { //log.warn(`${request.action} ${request.service}/${request.resource}: ${statusCodeMap.get(response.status)}`);
                    legacyResponse.send(statusCodeMap.get(response.status), errorData || response.data);
                });
            };


            return response;
        }











        convertIncomingRequest(legacyRequest) {
            let action = legacyRequest.getActionName();


            // relation stuff
            if (action === 'create' && legacyRequest.hasRelatedTo()) action = 'createRelation';
            if (action === 'createOrUpdate' && legacyRequest.hasRelatedTo()) action = 'createOrUpdateRelation';
            if (action === 'update' && legacyRequest.hasRelatedTo()) action = 'updateRelation';
            if (action === 'delete' && legacyRequest.hasRelatedTo()) action = 'deleteRelation';
            if (action === 'list' && legacyRequest.hasRelatedTo()) action = 'listRelation';


            // bulk operations
            if (action === 'delete' && legacyRequest.hasResourceId()) action = 'deleteOne';
            if (action === 'update' && legacyRequest.hasResourceId()) action = 'updateOne';
            if (action === 'create' && !type.array(legacyRequest.content)) action = 'createOne';
            if (action === 'createRelation' && !type.array(legacyRequest.content)) action = 'createOneRelation';
            if (action === 'createOrUpdateRelation' && !type.array(legacyRequest.content)) action = 'createOrUpdateOneRelation';
            if (action === 'updateRelation' && legacyRequest.hasResourceId()) action = 'updateOneRelation';
            if (action === 'deleteRelation' && legacyRequest.hasResourceId()) action = 'deleteOneRelation';
            if (action === 'createOrUpdate' && legacyRequest.hasResourceId()) action = 'createOrUpdateOne';


            const tokens = legacyRequest.accessTokens ? legacyRequest.accessTokens : (legacyRequest.accessToken ? [legacyRequest.accessToken] : []);

            // limit & offset. it's implemented wrong anyway on legacy :/
            const range = legacyRequest.getRange();


            if (debug) {
                log.info(`service-bridge: converting legacy to distributed request ...`);
                log.debug(`legacy request: action -> ${legacyRequest.getActionName()}, resource -> ${legacyRequest.collection}, resourceId -> ${legacyRequest.resourceId}, remoteResource -> ${(legacyRequest.relatedTo ? legacyRequest.relatedTo.model : undefined)}, remoteResourceId -> ${(legacyRequest.relatedTo ? legacyRequest.relatedTo.id : undefined)}`);
            }

            // extract servicename
            let service;
            const index = legacyRequest.collection.indexOf('.');
            if (index >= 0) {
                service = legacyRequest.collection.substr(0, index);
                legacyRequest.collection = legacyRequest.collection.substr(index+1);
            }


            // remote servicename
            let remoteService;
            let remoteResource;
            if (legacyRequest.relatedTo && legacyRequest.relatedTo.model) {
                remoteResource = legacyRequest.relatedTo.model;


                const remoteIndex = remoteResource.indexOf('.');
                if (remoteIndex >= 0) {
                    remoteService = remoteResource.substr(0, remoteIndex);
                    remoteResource = remoteResource.substr(remoteIndex+1);
                }
            }

            if (!remoteService) remoteService = 'legacy';


            const responseFormats = [];
            const legacyFormats = legacyRequest.getFormats();
            if (legacyFormats && legacyFormats.length) {
                legacyFormats.forEach((format) => {
                    responseFormats.push(`${format.getType()}/${format.getSubtype()}`);
                });
            }


            const request = new RelationalRequest({
                  resource              : legacyRequest.collection
                , action                : action
                , service               : service
                , resourceId            : legacyRequest.resourceId
                , remoteResource        : remoteResource
                , remoteResourceId      : legacyRequest.relatedTo ? legacyRequest.relatedTo.id : undefined
                , remoteService         : remoteService
                , filter                : this.convertIncomingFilter(legacyRequest, service)
                , selection             : legacyRequest.getFields()
                , relationalSelection   : this.convertIncomingRelationalSelection(legacyRequest, service)
                , data                  : legacyRequest.content
                , tokens                : tokens
                , limit                 : ((range && range.to !== null) ? (range.to - (range.from || 0) + 1) : null)
                , offset                : (range ? (range.from || 0) : null)
                , options               : legacyRequest.getParameters()
                , languages             : legacyRequest.languages
                , responseFormats       : responseFormats
            });


            if (debug) {
                log.debug(`distributed request: action -> ${request.getAction()}, service -> ${request.getService()}, resource -> ${request.getResource()}, resourceId -> ${request.getResourceId()}, remoteService -> ${request.getRemoteService()}, remoteResource -> ${(request.getRemoteResource())}, remoteResourceId -> ${(request.getRemoteResourceId())}`);
            }

            return request;
        }










        convertIncomingRelationalSelection(request, service) {
            const selections = this.convertIncomingSelection(request, service);

            // store them, they may be used later
            const relationalSelection = new Map();


            if (selections && selections.length) {
                selections.forEach((selection) => {
                    relationalSelection.set(selection.resource, selection);
                });
            }

            return relationalSelection;
        }



        convertIncomingSelection(request, service) {
            const selections = [];


            if (request.hasSubRequests()) {
                request.getSubRequests().forEach((subRequest) => {

                    // check for containedd service in the collection
                    let resource = subRequest.getCollection();
                    const index = resource.indexOf(':');

                    if (index >= 0) {
                        service = resource.substr(0, index);
                        resource = resource.substr(index+1);
                    }



                    const selection = new RelationalSelection({
                          selection     : subRequest.getFields()
                        , filter        : this.convertIncomingObjectTree(subRequest.getFilters(), new FilterBuilder())
                        , resource      : resource
                        , service       : service
                    });

                    selections.push(selection);

                    const subSelections = this.convertIncomingSelection(subRequest, service);
                    if (subSelections && subSelections.length) selection.addSubSelections(subSelections);
                });
            }

            return selections;
        }











        convertIncomingFilter(request) {
            const filter = new FilterBuilder();
            this.convertIncomingObjectTree(request.getFilters(), filter);
            return filter && filter.children.length ? filter: null;
        }



        convertIncomingFilters(filters, filterBuilder) {
            if (type.array(filters)) {
                if (filters.length > 1) {
                    const andBuilder = filterBuilder.and();

                    filters.forEach((filter) => {
                        this.convertIncomingFilters(filter, andBuilder);
                    });
                }
                else if (filters.length === 1) return this.convertIncomingFilters(filters[0], filterBuilder);
                else return;
            }
            else if (type.object(filters)) {

                // actual filter
                const comparatorFilter = filterBuilder.comparator(filters.operator);

                if (type.function(filters.value)) {
                    const result = filters.value(); //log(result);
                    comparatorFilter.remove().fn(result.name, result.parameters);
                }
                else comparatorFilter.value(filters.value);
            }
        }



        convertIncomingObjectTree(filters, filterBuilder) {
            if (type.object(filters)) {
                const keys = Object.keys(filters);

                if (keys.length > 1) filterBuilder = filterBuilder.and();

                keys.forEach((key) => {
                    const value = filters[key];

                    if (type.object(value)) {

                        // we are an enitiy
                        if (key.includes('.')) key = key.substr(key.indexOf('.')+1);

                        this.convertIncomingObjectTree(value, filterBuilder.entity(key));
                    }
                    else if (type.array(value)) {

                        // we are the property
                        this.convertIncomingFilters(value, filterBuilder.property(key));
                    }
                });
            } else this.convertIncomingFilters(filters, filterBuilder);
        }
    }
})();
