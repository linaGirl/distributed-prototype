(function() {
    'use strict';



    const parser    = require('distributed-http-header-parser');
    const type      = require('ee-types');
    const log       = require('ee-log');
    const Cachd     = require('cachd');
    const crypto    = require('crypto');





    class APIGatewayParserChild {

        constructor() {

            // cache most used headers
            this.cache = new Cachd({
                  ttl               : 3600*1000*24 // 24h
                , maxLength         : 5000
                , removalStrategy   : 'leastUsed'
            });

            // let us parse headers :)
            process.on('message', this.request.bind(this));
        }








        /**
         * accept requests
         */
        request(message) {
            switch (message.action) {
                case 'parse':
                    this.parse(message);
                    break;

                case 'config':
                    this.configure(message);
                    break;

                default:
                    process.send({
                          id        : message.id
                        , status    : 'error'
                        , message   : `Unknown action ${message.action}!`
                    });
            }
        }







        /**
         * let the server set configrations
         */
        configure(message) {
            if (message.cacheSize)  this.cache.maxLength = message.cacheSize;
            if (message.cacheTtl)   this.cache.ttl = message.cacheTtl;
        }







        /**
         * parse headers
         */
        parse(message) {
            let filter, selector, order;




            // filter
            if (type.string(message.data.filter)) {
                const id = this.md5(`filter:${message.data.filter}`);

                if (this.cache.has(id)) filter = this.cache.get(id);
                else {
                    try {
                        filter = parser.parseFilter(message.data.filter);
                        filter = this.formatFilter(filter);

                        this.cache.set(id, filter);
                    } catch (err) {
                        return process.send({
                              id        : message.id
                            , status    : 'error'
                            , message   : `Failed to parse filter: ${err.message}`
                        });
                    }
                }
            }





            // selector
            if (type.string(message.data.selector)) {
                const id = this.md5(`selector:${message.data.filter}`);

                if (this.cache.has(id)) filter = this.cache.get(id);
                else {
                    try {
                        selector = parser.parseSelect(message.data.selector);
                        selector = this.formatSelector(selector);

                        this.cache.set(id, selector);
                    } catch (err) {
                        return process.send({
                              id        : message.id
                            , status    : 'error'
                            , message   : `Failed to parse selector: ${err.message}`
                        });
                    }
                }
            }




            // order
            if (type.string(message.data.order)) {
                const id = this.md5(`order:${message.data.filter}`);

                if (this.cache.has(id)) filter = this.cache.get(id);
                else {
                    try {
                        order = parser.parseOrder(message.data.order);
                        order = this.formatOrder(order);

                        this.cache.set(id, order);
                    } catch (err) {
                        return process.send({
                              id        : message.id
                            , status    : 'error'
                            , message   : `Failed to parse order: ${err.message}`
                        });
                    }
                }
            }


            // return to the server
            process.send({
                  id        : message.id
                , status    : 'ok'
                , data: {
                      filter    : filter
                    , selector  : selector
                    , order     : order
                }
            });
        }









        formatFilter(filter) {
            const out = {};

            switch (filter.kind) {

                case 'FilterStatement':
                    out.type = 'and'
                    out.children = filter.children.map(child => this.formatFilter(child));
                    break;


                case 'Selector':
                    if (filter.children.length) {
                        out.type = 'entity';
                        out.entityName = filter.identifier.value;
                        out.children = filter.children.map(child => this.formatFilter(child));
                    } else {
                        out.type = 'property';
                        out.propertyName = filter.identifier.value;
                        out.children = [this.formatFilter(filter.comparison)];
                    }
                    break;



                case 'Comparison':
                    if (filter.comparison.kind === 'FunctionNode') {
                        out.type = 'function';
                        out.functionName = filter.comparison.identifier.value;
                        out.children = filter.comparison.children.map(child => this.formatFilter(child));
                    } else {
                        out.type = 'comparator'
                        out.comparator = filter.comparator;
                        out.children = [this.formatFilter(filter.comparison)];
                    }
                    break;


                case 'LiteralNode':
                case 'Date':
                    out.type = 'value'
                    out.value = filter.value;
                    break;
            }


            return out;
        }









        formatSelector(selector) {
            const out = {};

            switch (selector.kind) {

                case 'SelectStatement':
                    out.type = 'and'
                    out.children = selector.children.map(child => this.formatSelector(child));
                    break;


                case 'Selector':
                    if (selector.children.length) {
                        out.type = 'entity';
                        out.entityName = selector.identifier.value;
                        out.children = selector.children.map(child => this.formatSelector(child));
                    } else if (selector.alias) {
                        out.type = 'function';
                        out.functionName = selector.alias.identifier.value;
                        out.children = selector.alias.children.map(child => this.formatSelector(child));
                    } else {
                        out.type = 'property';
                        out.propertyName = selector.identifier.value;
                    }
                    break;


                case 'LiteralNode':
                case 'Date':
                    out.type = 'value'
                    out.value = selector.value;
                    break;
            }


            return out;
        }









        formatOrder(order) {
            return order;
        }









        md5(str) {
            return crypto.createHash('md5').update(str).digest('hex');
        }
    };




    new APIGatewayParserChild();
})();
