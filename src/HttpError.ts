
/**
 * An error that can be thrown with a status code and additional information.
 * HttpError.Handler can be used as an Express error handler for these errors.
 */
export class HttpError extends Error {
    static Handler({ interceptor, catchAllErrors }: HandlerOptions = {}): import('express').ErrorRequestHandler {
        return async (err, _req, res, next) => {
            if (!(err instanceof HttpError)) {
                if (catchAllErrors) {
                    err = HttpError.fromError(err);
                } else {
                    return next(err);
                }
            }
            try {
                err = interceptor && await interceptor(err) || err;
            } catch (e) {
                // tslint:disable-next-line: no-console
                console.error('Error while handling previous error', e);
            }
            res.status(err.code).json({
                error: err.message,
                info: err.info,
            });
        };
    }

    static fromError(cause: Error, code?: number, info?: {}): HttpError;
    static fromError(cause: Error, code: number, description: string, info?: {}): HttpError;
    static fromError(cause: Error, code = 500, descriptionOrInfo?: string | {}, info?: {}) {
        if (typeof descriptionOrInfo === 'string') {
            return new HttpError(code, descriptionOrInfo, { ...info, cause });
        }
        return new HttpError(code, cause.message, { ...descriptionOrInfo, cause });
    }

    static BadRequest(description = 'Bad Request', info?: {}) { return new HttpError(400, description, info); }
    static Forbidden(description = 'Forbidden', info?: {}) { return new HttpError(403, description, info); }
    static NotFound(description = 'Resource Not Found', info?: {}) { return new HttpError(404, description, info); }
    static Conflict(description = 'Conflict', info?: {}) { return new HttpError(409, description, info); }
    static ServerError(description = 'Internal Server Error', info?: {}) { return new HttpError(500, description, info); }

    constructor(readonly code: number, description: string, readonly info: {} = {}, readonly originalError?: Error) {
        super(description);
    }
}

export interface HandlerOptions {
    interceptor?: (err: HttpError) => void | HttpError | Promise<HttpError | void>;
    catchAllErrors?: boolean;
}
