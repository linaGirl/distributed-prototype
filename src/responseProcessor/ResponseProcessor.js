{
    'use strict';

    const log = require('ee-log');




    module.exports = class ResponseProcessor {

        constructor() {

            // holds all renderer instances available
            this.renderers = new Set();

            // holds decisions on which renderer to use on 
            // which type and subType. it's a cache
            this.decisionCache = new Map();
        }









        /**
        * send the response
        */
        async processResponse({
            httpResponse,
            httpRequest,
            distributedResponse,
            distributedRequest,
        }) {
            const accepts = httpRequest.accepts();
            let renderer;
            let i = 0;

            while(!(renderer = this.getRenderer(accepts[i].split('/'))) && i < accepts.length) i++;

            if (renderer) {
                await renderer.render({
                    httpResponse,
                    httpRequest,
                    distributedResponse,
                    distributedRequest,
                });
            } else {
                httpResponse.status(406).send({
                    status: 406,
                    code: 'not_acceptable',
                    description: `Cannot render response, no suitable renderer found for '${accepts.join(', ')}'!`
                });
            }
        }











        /**
        * get the right renderer for a given type
        * and subType
        */
        getRenderer([type, subType]) {
            const id = `${type}/${subType}`;

            if (this.decisionCache.has(id)) return this.decisionCache.get(id);
            else {
                let highestScore = 0;
                let selectedRenderer;

                for (const renderer of this.renderers.values()) {
                    const score = renderer.getScore(type, subType);

                    if (score > highestScore) {
                        selectedRenderer = renderer;
                        highestScore = score;
                    } 
                }


                if (selectedRenderer) {

                    // cache for the next call
                    this.decisionCache.set(id, selectedRenderer);

                    return selectedRenderer;
                } else {
                    return null;
                }
            }
        }









        /**
        * add a new renderer to the list
        * of available renderer
        */
        registerRenderer(renderer) {
            this.renderers.add(renderer);

            // bust the cache, it may be invalid now
            this.decisionCache = new Map();
        }
    }
}