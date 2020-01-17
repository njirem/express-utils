import { PassThrough } from 'stream';
import { HttpError } from './HttpError';
import { sendWs, wrapMiddleware, wrapWsMiddleware } from './middleware-wrapper';

describe(wrapMiddleware, () => {
    const handler = jest.fn();
    const wrappedHandler = wrapMiddleware(handler);
    const next = jest.fn();
    const req = {} as any;
    let res: any;
    beforeEach(() => {
        res = new PassThrough();
        res.finished = false;
        res.status = jest.fn();
        res.json = jest.fn();
        res.hasHeader = jest.fn().mockReturnValue(false);
        res.set = jest.fn();
        res.status.mockReturnValue(res);
    });

    it('should still call the given function', () => {
        wrappedHandler(req, res, next);
        expect(handler).toBeCalledWith(req, res, next);
    });

    it(`should send a status 200 with the return value if the response hasn't been sent yet`, async () => {
        const retVal = { result: 'some result value' };
        handler.mockResolvedValueOnce(retVal);
        await wrappedHandler(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(retVal);

        const retArr = [{ result: 'some result value' }, { and: 'another one' }];
        handler.mockResolvedValueOnce(retArr);
        await wrappedHandler(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(retArr);

    });

    describe('streaming', () => {
        it('should pipe a returned readable stream', async () => {
            const stream = new PassThrough;
            const dataSpy = jest.fn();
            res.on('data', dataSpy);
            jest.spyOn(stream, 'pipe');
            res.once('pipe', () => {
                stream.write('something');
                stream.end();
            });
            handler.mockReturnValueOnce(stream);
            await wrappedHandler(req, res, next);
            expect(stream.pipe).toHaveBeenCalled();
            expect(dataSpy).toHaveBeenCalledWith(Buffer.from('something'));
        });

        it('should optionally try to set the `Content-Type` header', async () => {
            let stream = new PassThrough;
            res.on('pipe', () => stream.end());
            handler.mockReturnValueOnce(stream);
            res.hasHeader.mockReturnValueOnce(true);
            await wrappedHandler(req, res, next);
            expect(res.hasHeader).toHaveBeenCalledTimes(1);
            expect(res.set).not.toHaveBeenCalled();

            stream = new PassThrough;
            handler.mockReturnValueOnce(stream);
            res.hasHeader.mockReturnValueOnce(false);
            await wrappedHandler(req, res, next);
            expect(res.hasHeader).toHaveBeenCalledTimes(2);
            expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/json');
        });

        it('should next an error in the stream to express error handlers', async () => {
            const stream = new PassThrough;
            jest.spyOn(stream, 'pipe');
            const error = new Error('Foo');
            res.once('pipe', () => stream.emit('error', error));
            handler.mockReturnValueOnce(stream);
            await wrappedHandler(req, res, next);
            expect(next).toHaveBeenCalledWith(error);
        });

        it('should not send anything if the response has already been piped to', async () => {
            const retVal = { result: 'some result value' };
            handler.mockImplementationOnce(() => {
                res.pipe('some stream');
                return retVal;
            });
            await wrappedHandler(req, res, next);
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });
    });

    it('should not send anything if the returned value is not a readable stream or a plain object', async () => {
        class Foo { result = 'some result value'; }
        handler.mockResolvedValueOnce(new Foo);
        await wrappedHandler(req, res, next);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    it('should not send anything if nothing is returned', async () => {
        handler.mockResolvedValueOnce(undefined);
        await wrappedHandler(req, res, next);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    it('should not send anything if the response has already been finished', async () => {
        res.finished = true;
        const retVal = { result: 'some result value' };
        handler.mockResolvedValueOnce(retVal);
        await wrappedHandler(req, res, next);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next if the handler returns a rejected promise', async () => {
        const error = 'any error';
        handler.mockReturnValueOnce(Promise.reject(error));
        await wrappedHandler(req, res, next).catch(() => { });
        expect(next).toHaveBeenCalledWith(error);
    });

    it('should not call next if the handler returns a resolved promise', async () => {
        const value = 'any value';
        handler.mockReturnValueOnce(Promise.resolve(value));
        await wrappedHandler(req, res, next);
        expect(next).not.toHaveBeenCalled();
    });
});

describe('WebSockets', () => {
    const ws = {
        send: jest.fn().mockImplementation((_msg, cb) => cb(null)),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
    } as any;

    describe(sendWs, () => {

        it('should send on the given webSocket', () => {
            sendWs(ws, 'my message');
            expect(ws.send).toHaveBeenCalledTimes(1);
        });

        it('should not try to send anything if `undefined` is given', () => {
            sendWs(ws, undefined);
            expect(ws.send).not.toHaveBeenCalled();
        });

        it('should resolve when send succeeds', async () => {
            await expect(sendWs(ws, 'my message')).resolves.toBe(undefined);
        });

        it('should reject when send fails', async () => {
            const err = new Error('hoi');
            ws.send.mockImplementationOnce((_msg: string, cb: (err: Error) => void) => cb(err));
            await expect(sendWs(ws, 'my message')).rejects.toBe(err);
        });

        it('should send strings unaltered', () => {
            sendWs(ws, 'my message');
            expect(ws.send).toHaveBeenCalledWith('my message', expect.anything());
        });

        it('should encode anything that is not a string as JSON', () => {
            sendWs(ws, { message: 'my message' });
            expect(ws.send).toHaveBeenCalledWith('{"message":"my message"}', expect.anything());
        });
    });

    describe(wrapWsMiddleware, () => {
        const handler = jest.fn();
        const wrappedHandler = wrapWsMiddleware(handler);
        const req = {} as any;
        const next = jest.fn();

        it('should call the given middleware', () => {
            wrappedHandler(ws, req, next);
            expect(handler).toHaveBeenCalledWith(req, ws, next);
        });

        describe('as a Promise', () => {
            it('should send any data that is returned', async () => {
                handler.mockResolvedValueOnce('my message');
                await wrappedHandler(ws, req, next);
                expect(ws.send).toHaveBeenCalledTimes(1);
                expect(ws.send).toHaveBeenCalledWith('my message', expect.anything());
            });

            it('should wait for the function to finish and close the connection', async () => {
                let resolve: () => void;
                handler.mockReturnValueOnce(new Promise(r => resolve = r));

                const promise = wrappedHandler(ws, req, next);

                expect(ws.close).not.toHaveBeenCalled();

                resolve!();
                await promise;

                expect(ws.close).toHaveBeenCalled();
            });

            it('should not close the connection if keepAlive is set', async () => {
                handler.mockReturnValueOnce(Promise.resolve());

                await wrapWsMiddleware(handler, true)(ws, req, next);
                expect(ws.close).not.toHaveBeenCalled();
            });

            it('should catch any errors and close the connection with that error', async () => {
                handler.mockReturnValueOnce(Promise.reject(new Error('something')));

                await wrappedHandler(ws, req, next);

                expect(ws.close).toHaveBeenCalledWith(1011, JSON.stringify({
                    code: 500,
                    error: 'something',
                    info: {
                        cause: {},
                    },
                }));
            });
        });

        describe('as async generator', () => {
            const secondMessage = { second: 'message' };
            async function* asGenerator(request: any) {
                await Promise.resolve();
                yield 'my first message';
                if (request instanceof Error) { throw request; }
                await Promise.resolve();
                yield secondMessage;
            }
            beforeEach(() => handler.mockImplementationOnce(asGenerator));

            it('should send any data that is returned', async () => {
                await wrappedHandler(ws, req, next);
                expect(ws.send.mock.calls).toEqual([
                    ['my first message', expect.anything()],
                    [JSON.stringify(secondMessage), expect.anything()],
                ]);
            });

            it('should wait for the function to finish and close the connection', async () => {
                const promise = wrappedHandler(ws, req, next);

                expect(ws.close).not.toHaveBeenCalled();

                await promise;

                expect(ws.close).toHaveBeenCalled();
            });

            it('should not close the connection if keepAlive is set', async () => {
                await wrapWsMiddleware(handler, true)(ws, req, next);
                expect(ws.close).not.toHaveBeenCalled();
            });

            it('should catch any errors and close the connection with that error', async () => {
                await wrappedHandler(ws, new Error('Woopsie') as any, next);

                // It should have thrown after the first message
                expect(ws.send).toHaveBeenCalledTimes(1);
                expect(ws.close).toHaveBeenCalledWith(1011, JSON.stringify({
                    code: 500,
                    error: 'Woopsie',
                    info: {
                        cause: {},
                    },
                }));
            });

            it('should send an HttpError as status 1011 with the code in the body', async () => {
                await wrappedHandler(ws, new HttpError(418, 'Coffee') as any, next);

                // It should have thrown after the first message
                expect(ws.send).toHaveBeenCalledTimes(1);
                expect(ws.close).toHaveBeenCalledWith(1011, JSON.stringify({
                    code: 418,
                    error: 'Coffee',
                    info: {},
                }));

            });
        });
    });
});
