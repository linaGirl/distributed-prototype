{
    'use strict';





    module.exports = class Logger {



        constructor(framework) {
            this.framework = framework[0].toUpperCase();
            this.framework = this.framework === 'D' ? this.framework.blue : this.framework.red;
            
            this.idCounter = 0;


            this.requestCache = new Map();
        }



        get id() {
            if (this.idCounter > 9999999) this.idCounter = 0;
            return (++this.idCounter)+'';
        }






        response({id, status, comment, time}) {
            if (this.requestCache.has(id)) {
                const config = this.requestCache.get(id);
                this.requestCache.delete(id);

    
                this.write({
                      action: config.action
                    , resource: config.resource
                    , id: id
                    , status: status
                    , comment: comment
                    , incoming: config.outgoing
                    , time: time
                    , service: config.service
                    , resourceId: config.resourceId
                    , remoteService: config.remoteService
                    , remoteResource: config.remoteResource
                    , remoteResourceId: config.remoteResourceId
                });
            }
        }






        waiting({id, time}) {
            if (this.requestCache.has(id)) {
                const config = this.requestCache.get(id);
                this.requestCache.delete(id);

    
                this.write({
                      action: config.action
                    , resource: config.resource
                    , id: id
                    , comment: `long running request!`.yellow.bold
                    , incoming: !config.outgoing
                    , isRequest: true
                    , time: time
                    , service: config.service
                    , resourceId: config.resourceId
                    , remoteService: config.remoteService
                    , remoteResource: config.remoteResource
                    , remoteResourceId: config.remoteResourceId
                });
            }
        }






        request({action, resource, comment, outgoing, service, resourceId, remoteService, remoteResource, remoteResourceId}) {
            const id = this.id;


            this.write({
                  incoming: !outgoing
                , action: action
                , resource: resource
                , id: id
                , comment: comment
                , isRequest: true
                , service: service
                , resourceId: resourceId
                , remoteService: remoteService
                , remoteResource: remoteResource
                , remoteResourceId: remoteResourceId
            });


            this.requestCache.set(id, {
                  action
                , resource
                , outgoing
                , resourceId
                , service
                , remoteService
                , remoteResource
                , remoteResourceId
            });


            return id;
        }




        write({
              service = ''
            , resourceId = ''
            , incoming = false
            , action = ''
            , resource = ''
            , status = ''
            , comment = ''
            , id
            , isRequest = false
            , time = 0
            , remoteService = ''
            , remoteResource = ''
            , remoteResourceId = ''
        }) {
            let text = `${this.framework}`+' | '.grey;

            text += `${incoming ? '⇢'.blue : '⇠'.cyan} `;
            text += `${(isRequest ? 'req'.blue : 'res'.green)}`.grey+' | '.grey;
            text += `${this.pad(id, 9)}`.grey+' │ '.grey;


            if (time < 500) text += `${this.pad(time+' ms', 7)}`.grey+' │ '.grey;
            else if (time >= 500 && time < 1000) text += `${this.pad(time+' ms', 7)}`.yellow+' │ '.grey;
            else text += `${this.pad(time+' ms', 7)}`.grey+' │ '.grey;
            

            text += `${this.fill(action, 22)}`.magenta.bold+' | '.grey;
            

            if (status === 'ok') text += `${this.fill(status, 22)}`.green+' | '.grey;
            else if (status === 'error' || status === 'service_exception') text += `${this.fill(status, 22)}`.red.bold+' | '.grey;
            else text += `${this.fill(status, 22)}`.yellow+' | '.grey;


            text += service.blue;
            text += '/'.grey+resource.white;

            
            if (resourceId) text += '/'.grey+resourceId.cyan;
            if (remoteService && remoteResource) text += '/'.grey+remoteService.blue;
            if (remoteResource) text += '/'.grey+remoteResource.white;
            if (remoteResourceId) text += '/'.grey+remoteResourceId.cyan;
            
            text += `${(comment ? '   ➟  ' : '')+comment.grey}`;

            console.log(text.grey);
        }






        pad(text, len) {
            const l = text.length > len ? 0 : len - text.length;
            return ' '.repeat(l) + text;
        }




        fill(text, len) {
            const l = text.length > len ? 0 : len - text.length;
            return text + (' '.repeat(l));
        }
    }
}