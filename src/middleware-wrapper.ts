
/**
 * Wraps a middleware handler, so that async errors (returned rejected Promises) will be caught and handled by Express.
 * This should be handled by Express itself from v5 upwards.
 *
 * If the middleware handler returns an object value it will be sent back with a status 200.
 * This behavior can be prevented by setting `ignoreReturnValue` to `true`.
 */
export function wrapMiddleware(handler: import('express').Handler, ignoreReturnValue = false): import('express').Handler {
    return async (req, res, next) => {
        try {
            const retVal = await handler.call(undefined, req, res, next);
            if (!ignoreReturnValue && retVal != null && typeof retVal === 'object' && !res.finished) {
                res.status(200).json(retVal);
            }
        } catch (e) {
            next(e);
        }
    };
}