{
    'use strict';

    const ResponseRenderer = require('./Renderer');


    module.exports = class ImageResponseRenderer extends ResponseRenderer {
        

        constructor() {
            super();

            // should handle all images well
            this.registerType('image', '*', 1000);
        }
    }
}