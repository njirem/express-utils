
/**
 * An error that can be thrown with a status code and additional information.
 * HttpError.Handler can be used as an Express error handler for these errors.
 */
export class HttpError extends Error {
    /**
     * Create an ErrorRequestHandler, to convert HttpErrors into responses in Express
     */
    static Handler({ interceptor, catchAllErrors }: HandlerOptions = {}): import('express').ErrorRequestHandler {
        return async (err, req, res, next) => {
            if (!(err instanceof HttpError)) {
                if (catchAllErrors) {
                    err = HttpError.fromError(err);
                } else {
                    return next(err);
                }
            }
            try {
                err = interceptor && await interceptor(err, req) || err;
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

    /**
     * Create a HttpError based on another Error. Can be useful if a caught error needs to be rethrown with a specific status code and/or message.
     *
     * @param cause The original Error that caused this HttpError
     * @param code The Http status code
     * @param info Additional information to be passed on
     */
    static fromError(cause: Error, code?: number, info?: {}): HttpError;
    static fromError(cause: Error, code: number, description: string, info?: {}): HttpError;
    static fromError(cause: Error, code = getStatusCode(cause), descriptionOrInfo?: string | {}, info?: {}) {
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
    /**
     * An interceptor for al the errors, before they are converted into a response.
     * Can be used to log the error and/or return a new (e.g. redacted) error.
     */
    interceptor?: (err: HttpError, req: import('express').Request) => void | HttpError | Promise<HttpError | void>;
    /**
     * By default the handler will only catch `HttpError`s.
     * If this option is set to true, the handler will also catch regular errors as status 500 HttpErrors.
     */
    catchAllErrors?: boolean;
}

function getStatusCode(cause: any) {
    if (typeof cause.statusCode === 'number') { return cause.statusCode; }
    if (typeof cause.code === 'number') { return cause.code; }
    if (typeof cause.errorCode === 'number') { return cause.errorCode; }
    return 500;
}
