{
    'use strict';


    const ResponseProcessor = require('./ResponseProcessor');
    const JsonRenderer = require('./renderer/Json');
    const ImageRenderer = require('./renderer/Image');


    module.exports = class GetResponseRenderer extends ResponseProcessor {


        constructor() {
            super();

            // register all available renderers
            this.registerRenderer(new JsonRenderer());
            this.registerRenderer(new ImageRenderer());
        }
    }
}