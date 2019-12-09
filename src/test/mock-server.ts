import { EventEmitter } from 'events';
import { HttpError } from '../HttpError';

export class MockServer<Body extends {
    put?: {};
    patch?: {};
    post?: {};
    delete?: {};
    get?: {};
}> {
    static globalDefaults: MockServer.Options = {
        url: '/',
        method: 'GET',
        assertCode: 200,
        errorHandlers: [HttpError.Handler({ catchAllErrors: true })],
    };
    private defaults: MockServer.Options;
    constructor(private readonly router: import('express').Router, defaults?: Partial<MockServer.Options>) {
        this.defaults = { ...MockServer.globalDefaults, ...defaults };
    }

    setDefaults(newDefaults: Partial<MockServer.Options>) {
        let oldDefaults: MockServer.Options;
        beforeAll(() => {
            oldDefaults = this.defaults;
            this.defaults = this.mergeOptions(newDefaults);
        });
        afterAll(() => {
            this.defaults = oldDefaults;
        });
    }

    mergeOptions<T>(options?: Partial<MockServer.Options<T>>): MockServer.Options<T> {
        return { ...this.defaults as MockServer.Options<T>, ...options };
    }

    async request<T>(options?: Partial<MockServer.Options>) {
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

    private createRequest(options: MockServer.Options) {
        const { url, method } = options;
        const body = decode(options.body);
        const query = decode(options.query);
        let req = { url, method, body, query };
        if (options.requestInterceptor) { req = options.requestInterceptor(req, options) || req; }
        return req as unknown as import('express').Request;
    }

    async post<R = {}, T = Body['post']>(options?: Omit<Partial<MockServer.Options<T>>, 'method' | 'query'>) {
        return this.request<R>({ ...options, method: 'POST' });
    }

    async put<R = {}, T = Body['put']>(options?: Omit<Partial<MockServer.Options<T>>, 'method' | 'query'>) {
        return this.request<R>({ ...options, method: 'PUT' });
    }

    async patch<R = {}, T = Body['patch']>(options?: Omit<Partial<MockServer.Options<T>>, 'method' | 'query'>) {
        return this.request<R>({ ...options, method: 'PATCH' });
    }

    async delete<R = {}, T = Body['delete']>(options?: Omit<Partial<MockServer.Options<T>>, 'method' | 'query'>) {
        return this.request<R>({ ...options, method: 'DELETE' });
    }

    async get<R = {}, T = Body['get']>(options?: Omit<Partial<MockServer.Options<T>>, 'method' | 'body'>) {
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
interface MockRequest {
    url: string;
    method: Method;
    query: string;
    body: any;
}
declare global {
    namespace MockServer {
        interface Options<T = {}> {
            url: string;
            method: Method;
            body?: T | (() => T);
            query?: T | (() => T);
            assertCode: number;
            requestInterceptor?(req: MockRequest, options: Options): MockRequest | void;
            errorHandlers: Array<import('express').ErrorRequestHandler>;
        }
    }
}

export function decode(objOrFactory?: {} | (() => {})) {
    return (typeof objOrFactory === 'function' ? objOrFactory() : objOrFactory) || {};
}
