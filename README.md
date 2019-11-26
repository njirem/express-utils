# Express Utils

A simple library with some utils to use with Express. 
Below is a short summary of the features, but more information can be found in the code/tests.

## Main features:

### HttpError
A subclass of the native JavaScript `Error`. Can be used to add a status code and additional info to an Error. 
The `HttpError` meant to be used in conjunction with the `HttpError.Handler()` middleware.

#### HttpError.Handler()
Will construct an Express ErrorRequest Handler that handles HttpErrors thrown in a request.

### wrapMiddleware(handler: Express.Handler, ignoreReturnValue?: boolean)
Can be used to wrap Express Handlers, will catch async errors (rejected promises) and will feed them back into the Express `next` to be handled by the regular ErrorRequest Handlers.

By default this function will also send any returned (non-null) object with a status 200 as json. Of course only if no response has already been sent and iff `ignoreReturnValue` is not `true`.


### Example:
```typescript
// The `wrapMiddleware` function will catch the HttpError 
// and forward it to the `Handler`
app.get(wrapMiddleware(async (req, res) => {
    // Business as usual in an Express Handler...
    // ...

    // And at some point..
    // The `HttpError.Handler()` below will catch this and return:
    // `res.status(418).json({ error: 'What am I?' });`
    throw new HttpError(418, `What am I?`);
}));

app.get(wrapMiddleware(async(req, res) => {
    // By default returned objects will be sent as
    // `res.status(200).json({ some: 'thing' });`
    return { some: 'thing' };
}));

// This will handle all the thrown `HttpError`s
app.use(HttpError.Handler());
```

### Disclaimer
This is mainly used by me and projects I work on. There could be big issues with the implementation or documentation I haven't noticed because I simply don't use it that way.

So use at your own risk and if some feature or documentation is missing/faulty/etc.: PR's are welcome!
