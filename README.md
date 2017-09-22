#distributed-prototype




#### sub-request creation

often its required to send requests to other services
that should have the same basic configuration as the 
incoming request. this applies especially to user/app 
authentication tokens, languages, request and response 
formats and more. instead of producing new requests and
manually populating them one can apply this data from
existing requests to new or other existing requests
using the following syntax:

    // create a new request from the existing one
    // transferring a default set of parameters
    const newRequest = RelatedRequest.from(oldRequest);

    // this defines what a successful response
    // looks like
    newRequest.expect('ok');

    // the response will only be returned
    // if it has the response status «ok»
    const newReponse = await newRequest.send(this);

    // this makes it possible to you to only handle
    // the response if it has a value to you
    if (newReponse) {

    }



this will not only copy those attributes to the new
request but also redirect error responses directly to
the original request since the manual handling is not 
practical. You, the user, may still handle specific 
response outcomes.






#### response status handling

if a hook fails on the response he response needs
to be reset to an error status. this can be done using
the clear method.

    response.clear();






#### Hooks

the framework provides a set of lifecycle hooks on
the different objects. they can be registered using 
the following syntax


    response.registerHook('name', fn);
    response.removeHook('name', fn);


#### Method invocation

- the method must be asynchronous, thus return a promise
- if the method execution has finished and the response
  was not yet sent, the return value of the promise is sent
  along with the default status or an error status if an 
  error has occurred 
- the default pattern to implement is not to send the response
  but let that to be handled by the methods invocator



    async list(request, response) {

        // return the promise, the invoator will handle the respone
        return await this.db.event({
            name: 'lina'
        }).find();
    }


this behavior enables easy inheritance patterns

    
    async list(request, response) {

        // let super get the required data
        const data = await super.list(request, response);

        // do stuff witrh the data, return it for 
        // sending it out
        data.fun = true;

        return data;
    }
