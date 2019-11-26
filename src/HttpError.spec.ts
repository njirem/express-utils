
import { HandlerOptions, HttpError } from './HttpError';
describe(HttpError, () => {
    it('should still be instance of Error', () => {
        expect(new HttpError(400, 'MyError')).toBeInstanceOf(Error);
    });

    it('should have the given `code`, `message` and `info` properties', () => {
        const message = 'Error message';
        const info = { cause: 'Some reason' };
        const code = 401;
        const err = new HttpError(code, message, info);
        expect(err).toEqual(
            expect.objectContaining({
                code,
                message,
                info,
            }),
        );
    });

    it('should be able to be passed an original Error', () => {
        const cause = new Error('original');
        const info = { some: 'info' };

        expect(HttpError.fromError(cause)).toEqual(expect.objectContaining({
            message: 'original', code: 500, info: { cause }
        }));

        expect(HttpError.fromError(cause, 400)).toEqual(expect.objectContaining({
            message: 'original', code: 400, info: { cause }
        }));

        expect(HttpError.fromError(cause, 400, info)).toEqual(expect.objectContaining({
            message: 'original', code: 400, info: { ...info, cause }
        }));

        expect(HttpError.fromError(cause, 400, 'myMessage', info)).toEqual(expect.objectContaining({
            message: 'myMessage', code: 400, info: { ...info, cause }
        }));

        expect(HttpError.fromError(cause, 400, 'myMessage')).toEqual(expect.objectContaining({
            message: 'myMessage', code: 400, info: { cause }
        }));
    });

    it('should have shortcuts for different errors', () => {
        expect(HttpError.BadRequest()).toEqual(expect.objectContaining({
            code: 400, message: 'Bad Request', info: {},
        }));
        expect(HttpError.Forbidden()).toEqual(expect.objectContaining({
            code: 403, message: 'Forbidden', info: {},
        }));
        expect(HttpError.NotFound()).toEqual(expect.objectContaining({
            code: 404, message: 'Resource Not Found', info: {},
        }));
        expect(HttpError.Conflict()).toEqual(expect.objectContaining({
            code: 409, message: 'Conflict', info: {},
        }));
        expect(HttpError.ServerError()).toEqual(expect.objectContaining({
            code: 500, message: 'Internal Server Error', info: {},
        }));
    });

    describe(HttpError.Handler, () => {
        it('should send the response with the given code, message and info', async () => {
            const { status, json, next } = await call(new HttpError(418, 'Teapot', { some: 'info' }));

            expect(status).toHaveBeenCalledWith(418);
            expect(json).toHaveBeenCalledWith({ error: 'Teapot', info: { some: 'info' } });
            expect(next).not.toHaveBeenCalled();
        });

        describe('non HttpErrors', () => {
            it('should send other Errors to the next middleware', async () => {
                const err = new Error('Foo');
                const { status, json, next } = await call(err);

                expect(status).not.toHaveBeenCalled();
                expect(json).not.toHaveBeenCalled();
                expect(next).toHaveBeenCalledWith(err);
            });
            it('should be possible to handle other Errors as well', async () => {
                const err = new Error('Foo');
                const { status, json, next } = await call(err, { catchAllErrors: true });

                expect(status).toHaveBeenCalledWith(500);
                expect(json).toHaveBeenCalledWith({ error: 'Foo', info: { cause: err } });
                expect(next).not.toHaveBeenCalled();
            });
        });

        describe('interceptor', () => {
            const interceptor = jest.fn();
            const httpError = new HttpError(409, 'Nope!');

            it('should be able to intercept the handler', async () => {
                await call(httpError, { interceptor });

                expect(interceptor).toHaveBeenCalledWith(httpError);
            });

            it('should always use an HttpError in the interceptor', async () => {
                const cause = new Error('Regular Error!?');
                await call(cause, { interceptor, catchAllErrors: true });

                expect(interceptor).toHaveBeenCalledWith(expect.any(HttpError));
                expect(interceptor.mock.calls[0][0]).toEqual(expect.objectContaining({
                    code: 500, message: 'Regular Error!?', info: { cause }
                }));
            });

            it('should still send the error', async () => {
                const { status, json, next } = await call(httpError, { interceptor });

                expect(interceptor).toHaveBeenCalledWith(httpError);
                expect(status).toHaveBeenCalledWith(409);
                expect(json).toHaveBeenCalledWith({ error: 'Nope!', info: {} });
                expect(next).not.toHaveBeenCalled();
            });

            it('should be able to alter the error', async () => {
                interceptor.mockReturnValueOnce(new HttpError(500, 'Yes!'));
                const { status, json, next } = await call(httpError, { interceptor });

                expect(interceptor).toHaveBeenCalledWith(httpError);
                expect(status).toHaveBeenCalledWith(500);
                expect(json).toHaveBeenCalledWith({ error: 'Yes!', info: {} });
                expect(next).not.toHaveBeenCalled();
            });

            it('should be able to return asynchronously', async () => {
                interceptor.mockResolvedValueOnce(new HttpError(500, 'Yes!'));
                const { status, json, next } = await call(httpError, { interceptor });

                expect(interceptor).toHaveBeenCalledWith(httpError);
                expect(status).toHaveBeenCalledWith(500);
                expect(json).toHaveBeenCalledWith({ error: 'Yes!', info: {} });
                expect(next).not.toHaveBeenCalled();
            });

            it('should ignore, but log errors thrown in the interceptor', async () => {
                // tslint:disable: no-console
                const thrownError = new Error('Foo!');
                jest.spyOn(console, 'error').mockImplementation(() => { });

                interceptor.mockRejectedValueOnce(thrownError);
                const firstCall = await call(httpError, { interceptor });
                expect(firstCall.status).toHaveBeenCalledWith(409);
                expect(console.error).toHaveBeenCalledTimes(1);
                expect(console.error).toHaveBeenLastCalledWith('Error while handling previous error', thrownError);

                interceptor.mockImplementationOnce(() => { throw thrownError; });
                const secondCall = await call(httpError, { interceptor });
                expect(secondCall.status).toHaveBeenCalledWith(409);
                expect(console.error).toHaveBeenCalledTimes(2);
                expect(console.error).toHaveBeenLastCalledWith('Error while handling previous error', thrownError);
                // tslint:enable: no-console
            });
        });

        async function call(error: Error, handlerOptions?: HandlerOptions) {
            const handler = HttpError.Handler(handlerOptions);
            const status = jest.fn();
            const json = jest.fn();
            const next = jest.fn();
            const res = { status, json };
            res.status.mockReturnValue(res);
            await handler(error, {} as any, res as any, next);
            return { status, json, next };
        }
    });
});
