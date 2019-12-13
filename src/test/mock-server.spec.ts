import { Router } from 'express';
import { HttpError } from '../HttpError';
import { MockServer } from './mock-server';

describe(MockServer, () => {
    const router = Router();
    router.get('/', (_req, res) => res.status(200).json({ bar: true }));
    router.post('/', (req, res) => res.status(200).json({ receivedBody: req.body }));
    router.put('/throw', () => { throw new HttpError(409, 'Nope!', { some: 'info' }); });
    router.put('/throwNonError', () => { throw new Error('Woopsie'); });
    router.patch('/throwAsync', async (_req, _res, next) => {
        await Promise.resolve();
        next(new HttpError(409, 'Nope!', { some: 'info' }));
    });
    router.delete('/doubleStatus', (_req, res) => {
        res.status(200).status(201);
    });
    router.delete('/doubleSend', (_req, res) => {
        res.json({ some: 'data' }).send({ other: 'data' });
    });

    it('should be able to test a router', async () => {
        const server = new MockServer(router);
        await expect(server.get()).resolves.toEqual({ bar: true });
    });

    it('should be able to add properties to the request object', async () => {
        const server = new MockServer(router, {
            requestInterceptor(req) {
                req.body = { ...req.body, and: 'something else' };
            },
        });
        await expect(server.post({ body: { some: 'data' } })).resolves.toEqual({
            receivedBody: {
                some: 'data',
                and: 'something else',
            },
        });
    });

    it('should be able to us a function to set a default body/query based on the previous request', async () => {
        let body = { first: 'body' };
        const server = new MockServer(router, { body: () => body });
        body = await server.post();
        expect(body).toEqual({ receivedBody: { first: 'body' } });
        body = await server.post();
        expect(body).toEqual({ receivedBody: { receivedBody: { first: 'body' } } });
        body = await server.post();
        expect(body).toEqual({ receivedBody: { receivedBody: { receivedBody: { first: 'body' } } } });
    });

    it('should assert the status code, for easier verification of the request', async () => {
        const server = new MockServer(router);

        await expect(server.put({
            url: '/throw',
        })).rejects.toThrow('Assert failed, expected request to have code: 200, got 409');
    });

    describe('events', () => {
        const myRouter = Router();
        myRouter.get('/', () => { /**  */ });

        const server = new MockServer(router, {
            method: 'GET',
        });

        it(`should emit 'finish' when the request is done`, () => {
            const finish = jest.fn();

            const res = server.request();
            res.once('finish', finish);
            res.status(200).json({ foo: 'bar' });

            expect(finish).toHaveBeenCalledTimes(1);
        });

        it(`should emit 'close' when the request is cancelled`, () => {
            const close = jest.fn();

            const res = server.request();
            res.once('close', close);
            res.cancelRequest();

            expect(close).toHaveBeenCalledTimes(1);
        });

        it(`should not emit 'close' twice`, () => {
            const close = jest.fn();

            const res = server.request();
            res.on('close', close);
            res.cancelRequest();
            res.cancelRequest();

            expect(close).toHaveBeenCalledTimes(1);
        });

        it(`should not finish a cancelled request`, () => {
            const close = jest.fn();
            const finish = jest.fn();

            const res = server.request();
            res.on('close', close);
            res.on('finish', finish);
            res.cancelRequest();
            res.status(200).json({ response: 'maybe' });

            expect(close).toHaveBeenCalledTimes(1);
            expect(finish).not.toHaveBeenCalled();
        });
    });

    describe('errorHandlers', () => {
        const server = new MockServer(router, {
            url: '/throw',
            assertCode: 409,
        });

        it('should let errors be handled by the errorHandler', async () => {
            await expect(server.put()).resolves.toEqual({
                error: 'Nope!',
                info: { some: 'info' },
            });

            await expect(server.patch({ url: '/throwAsync' })).resolves.toEqual({
                error: 'Nope!',
                info: { some: 'info' },
            });
        });

        it('should be able to register multiple error Handlers', async () => {
            await expect(server.put({
                assertCode: 500,
                errorHandlers: [
                    err => { throw err; },
                    (err, _req, _res, next) => next(new Error(`I didn't do it: ${err.message}`)),
                    HttpError.Handler({ catchAllErrors: true }),
                ]
            })).resolves.toEqual({
                error: `I didn't do it: Nope!`,
                info: { cause: expect.anything() },
            });
        });

        it('should throw if the error was not handled', async () => {
            await expect(server.put({
                errorHandlers: []
            })).rejects.toThrow('Nope!');

            await expect(server.put({
                url: '/throwNonError',
                errorHandlers: []
            })).rejects.toThrow('Woopsie');

            await expect(server.put({
                errorHandlers: [err => { throw err; }]
            })).rejects.toThrow('Nope!');
        });
    });

    it('should throw if a route was not handled by this router', async () => {
        const server = new MockServer(router);

        await expect(server.get({ url: '/unknown' })).rejects.toThrow(`The route '/unknown' was not handled by this Router`);
    });

    it('should perform some standard checks', async () => {
        const server = new MockServer(router);
        await expect(server.delete({ url: '/doubleStatus' })).rejects.toThrow('Cannot set status code twice!');
        await expect(server.delete({ url: '/doubleSend' })).rejects.toThrow('Cannot set body twice!');
    });

    describe('when created in a describe', () => {
        const server = new MockServer(router, { body: { foo: 'bar' } });

        it('should be able to set defaults', async () => {
            await expect(server.post()).resolves.toEqual({
                receivedBody: {
                    foo: 'bar'
                }
            });
        });

        describe('in a describe', () => {
            server.setDefaults({ body: { cocktail: 'bar' } });

            it('should be able to overwrite those defaults', async () => {
                await expect(server.post()).resolves.toEqual({
                    receivedBody: {
                        cocktail: 'bar'
                    }
                });
            });
        });

        it('should not retain the defaults outside of the describe', async () => {
            await expect(server.post()).resolves.toEqual({
                receivedBody: {
                    foo: 'bar'
                }
            });
        });
    });
});
