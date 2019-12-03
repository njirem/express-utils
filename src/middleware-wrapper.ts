import { promisify } from 'util';
import { HttpError } from './HttpError';

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

export function sendWs(ws: import('ws'), message?: string | {}) {
    if (message === undefined) { return; }
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    return promisify(ws.send).call(ws, data);
}

type CustomWsRequestHandler<T extends string | {}> = (
    req: import('express').Request,
    ws: import('ws'),
    next: import('express').NextFunction,
) => AsyncGenerator<T> | Generator<T> | Promise<T>;

export function wrapWsMiddleware<T extends string | {}>(middleware: CustomWsRequestHandler<T>, keepAlive = false)
    : import('express-ws').WebsocketRequestHandler {
    return async (ws, req, next) => {
        try {
            const generatorOrPromise = middleware(req, ws, next);
            if (generatorOrPromise instanceof Promise || 'then' in generatorOrPromise) {
                await sendWs(ws, await generatorOrPromise);
            } else {
                for await (const message of generatorOrPromise) {
                    await sendWs(ws, message);
                }
            }
            if (!keepAlive) {
                ws.close();
                ws.removeAllListeners();
            }
        } catch (err) {
            if (!(err instanceof HttpError)) {
                err = HttpError.fromError(err);
            }
            ws.close(1011, JSON.stringify({
                code: err.code,
                error: err.message,
                info: err.info,
            }));
            ws.removeAllListeners();
        }
    };
}
