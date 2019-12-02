import { EventEmitter } from 'events';
import { HttpError } from '../HttpError';

const globalDefaults: InternalOptions = {
    userScopes: [],
    url: '/',
    method: 'GET',
    assertCode: 200,
    errorHandlers: [HttpError.Handler({ catchAllErrors: true })],
};

export interface ExistingResourceResponseBody { ID: string; }
export interface VersionedResourceResponseBody extends ExistingResourceResponseBody {
    VERSIE: string;
}

export class MockServer<Body extends {
    put?: {};
    patch?: {};
    post?: {};
    delete?: {};
    get?: {};
}> {
    private defaults: InternalOptions;
    constructor(private readonly router: import('express').Router, defaults?: Options) {
        this.defaults = { ...globalDefaults, ...defaults };
    }

    setDefaults(newDefaults: Options) {
        let oldDefaults: InternalOptions;
        beforeAll(() => {
            oldDefaults = this.defaults;
            this.defaults = this.mergeOptions(newDefaults);
        });
        afterAll(() => {
            this.defaults = oldDefaults;
        });
    }

    mergeOptions<T>(options?: Options<T>): InternalOptions<T> {
        return { ...this.defaults as InternalOptions<T>, ...options };
    }

    async request<T>(options?: Options) {
        const mergedOptions = this.mergeOptions(options);

        const req = this.createRequest(mergedOptions);
        const res = new Response<T>(mergedOptions.assertCode);
        this.router(req, res as any, async (e?: any) => {
            if (e === undefined) { return res.fail(new Error(`The route '${req.url}' was not handled by this Router`)); }
            await handleError(e);
        });
        return await res.waitForResult;

        async function handleError(err: any, i = 0) {
            const handler = mergedOptions.errorHandlers[i];
            if (!handler) {
                return res.fail(new Error('Error not handled by errorHandlers: ' + err && err.message || err));
            }
            try {
                await handler(err, req, res as any, error => handleError(error, i + 1));
            } catch (e) {
                handleError(e, i + 1);
            }
        }
    }

    private createRequest(options: InternalOptions) {
        const { url, method } = options;
        const body = decode(options.body);
        const query = decode(options.query);
        let req = { url, method, body, query };
        if (options.requestInterceptor) { req = options.requestInterceptor(req) || req; }
        return req as unknown as import('express').Request;
    }

    async post<R = VersionedResourceResponseBody, T = Body['post']>(options?: Omit<Options<T>, 'method' | 'query'>) {
        return this.request<R>({ ...options, method: 'POST' });
    }

    async put<R = VersionedResourceResponseBody, T = Body['put']>(options?: Omit<Options<T>, 'method' | 'query'>) {
        return this.request<R>({ ...options, method: 'PUT' });
    }

    async patch<R = VersionedResourceResponseBody, T = Body['patch']>(options?: Omit<Options<T>, 'method' | 'query'>) {
        return this.request<R>({ ...options, method: 'PATCH' });
    }

    async delete<R = ExistingResourceResponseBody, T = Body['delete']>(options?: Omit<Options<T>, 'method' | 'query'>) {
        return this.request<R>({ ...options, method: 'DELETE' });
    }

    async get<R = ExistingResourceResponseBody, T = Body['get']>(options?: Omit<Options<T>, 'method' | 'body'>) {
        return this.request<R>({ ...options, method: 'GET' });
    }

}

export interface ErrorBody {
    error: string;
    info?: {};
}

class Response<T> extends EventEmitter {
    constructor(private readonly assertCode: number) {
        super();
    }
    waitForResult = new Promise<T>((res, rej) => { this._done = res; this.fail = rej; });
    private _done!: (res: T) => void;
    fail!: (e: Error) => void;
    private _response: Partial<{
        code: number;
        body: T;
    }> = {};
    private _maybeDone() {
        const { body, code } = this._response;
        // tslint:disable-next-line: triple-equals
        if (body !== undefined && code != undefined) {
            try {
                if (this.assertCode !== code) {
                    return this.fail(
                        new Error(`Assert failed, expected request to have code: ${this.assertCode}, got ${code}\n${JSON.stringify(body, null, 2)}`)
                    );
                }
                return this._done(body);
            } finally {
                this.emit('close');
            }
        }
    }

    status(code: number) {
        if (this._response.code !== undefined) { this.fail(new Error('Cannot set status code twice!')); }
        this._response.code = code;
        this._maybeDone();
        return this;
    }

    json(body: T) { return this.send(body); }
    send(body: T) {
        if (this._response.body !== undefined) { this.fail(new Error('Cannot set body twice!')); }
        this._response.body = body;
        this._maybeDone();
        return this;
    }
}

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GET';
interface InternalOptions<T = {}> {
    userScopes: string[];
    url: string;
    method: Method;
    body?: T | (() => T);
    query?: T | (() => T);
    assertCode: number;
    requestInterceptor?(req: { url: string; method: Method; body: any; query: string; }): any;
    errorHandlers: Array<import('express').ErrorRequestHandler>;
}

export type Options<T = {}> = Partial<InternalOptions<T>>;

export function decode(objOrFactory?: {} | (() => {})) {
    return (typeof objOrFactory === 'function' ? objOrFactory() : objOrFactory) || {};
}
