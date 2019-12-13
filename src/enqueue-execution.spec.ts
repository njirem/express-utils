import { Router } from 'express';
import { createActiveExecutionsQueue, enqueueExecution, HANDLE_DIRECTLY, handleSequentially } from './enqueue-execution';
import { MapWithDefault } from './MapWithDefault';
import { MockServer } from './test';

describe(enqueueExecution, () => {
    const queue = createActiveExecutionsQueue<number>();
    afterEach(() => expect(queue.map.size).toBe(0));

    let cb: jest.Mock;
    beforeEach(() => cb = jest.fn());
    async function callable(group: number, id: number) {
        cb(`start-${group}-${id}`);
        await new Promise(r => setTimeout(r, 1));
        if (id > 1_000_000) {
            cb(`throw-${group}-${id}`);
            throw new Error('Nope!');
        }
        cb(`done--${group}-${id}`);
        return { group, id };
    }

    describe.each([true, false])('with `grouped`: %s', grouped => {
        const enqueued = enqueueExecution(callable, grouped ? group => group : undefined, queue);

        it('should execute the given function and return the result', async () => {
            await expect(enqueued(0, 1)).resolves.toEqual({
                group: 0,
                id: 1,
            });
            expect(cb.mock.calls).toEqual([
                ['start-0-1'],
                ['done--0-1'],
            ]);
        });

        it('should wait for the previous function', async () => {
            await Promise.all([
                enqueued(42, 1),
                enqueued(42, 2),
                enqueued(42, 3),
            ]);

            expect(cb.mock.calls).toEqual([
                ['start-42-1'],
                ['done--42-1'],
                ['start-42-2'],
                ['done--42-2'],
                ['start-42-3'],
                ['done--42-3'],
            ]);
        });

        it('should delete the cache when it is done', async () => {
            const deleteSpy = jest.spyOn(MapWithDefault.prototype, 'delete');
            await Promise.all([
                enqueued(42, 1).then(() => expect(deleteSpy).not.toHaveBeenCalled()),
                enqueued(42, 2),
            ]);
            expect(deleteSpy).toHaveBeenCalledWith(grouped ? 42 : undefined);
        });

        it('should continue when the function throws', async () => {
            expect(enqueued(42, Infinity)).rejects.toThrow('Nope!');
            await expect(enqueued(42, 100)).resolves.toEqual({ group: 42, id: 100 });

            expect(cb.mock.calls).toEqual([
                ['start-42-Infinity'],
                ['throw-42-Infinity'],
                ['start-42-100'],
                ['done--42-100'],
            ]);
        });

        if (grouped) {
            it('should not wait for functions in other groups', async () => {
                await Promise.all([
                    enqueued(42, 1),
                    enqueued(42, 2),
                    enqueued(69, 3),
                ]);

                expect(cb.mock.calls).toEqual([
                    ['start-42-1'],
                    ['start-69-3'],
                    ['done--42-1'],
                    ['start-42-2'],
                    ['done--69-3'],
                    ['done--42-2'],
                ]);
            });
        }
    });

    it('should be able to make sure any call is handled directly', async () => {
        const enqueued = enqueueExecution(callable, (group, id) => id === 9 ? HANDLE_DIRECTLY : group, queue);
        await Promise.all([
            enqueued(42, 1),
            enqueued(42, 2),
            enqueued(42, 9),
            enqueued(42, 9),
        ]);

        expect(cb.mock.calls).toEqual([
            ['start-42-9'],
            ['start-42-9'],
            ['start-42-1'],
            ['done--42-9'],
            ['done--42-9'],
            ['done--42-1'],
            ['start-42-2'],
            ['done--42-2'],
        ]);
    });

    it('should be able to group by another property', async () => {
        const enqueued = enqueueExecution(callable, (_group, id) => id, queue);
        await Promise.all([
            enqueued(42, 1),
            enqueued(69, 1),
            enqueued(42, 2),
        ]);

        expect(cb.mock.calls).toEqual([
            ['start-42-1'],
            ['start-42-2'],
            ['done--42-1'],
            ['start-69-1'],
            ['done--42-2'],
            ['done--69-1'],
        ]);
    });

    describe('group by multiple properties', () => {
        const enqueued = enqueueExecution(callable, (group, id) => ([group, id]), queue);

        it('should be able to group by multiple properties', async () => {
            await Promise.all([
                enqueued(42, 1),
                enqueued(42, 2),
                enqueued(69, 2),
            ]);

            expect(cb.mock.calls).toEqual([
                ['start-42-1'],
                ['done--42-1'],
                ['start-42-2'],
                ['done--42-2'],
                ['start-69-2'],
                ['done--69-2'],
            ]);
        });

        it('should not matter if any of the executions throws an error', async () => {
            await Promise.all([
                enqueued(42, 1),
                expect(enqueued(42, Infinity)).rejects.toThrow(),
                expect(enqueued(69, Infinity)).rejects.toThrow(),
                enqueued(69, 2),
            ]);

            expect(cb.mock.calls).toEqual([
                ['start-42-1'],
                ['done--42-1'],
                ['start-42-Infinity'],
                ['throw-42-Infinity'],
                ['start-69-Infinity'],
                ['throw-69-Infinity'],
                ['start-69-2'],
                ['done--69-2'],
            ]);

        });

        it('should wait for all of the given properties', async () => {
            await Promise.all([
                enqueued(42, 1),
                enqueued(42, 2),
                enqueued(42, 3),
                enqueued(69, 3),
                enqueued(70, 3),
                enqueued(71, 3),
            ]);

            expect(cb.mock.calls).toEqual([
                ['start-42-1'],
                ['done--42-1'],
                ['start-42-2'],
                ['done--42-2'],
                ['start-42-3'],
                ['done--42-3'],
                ['start-69-3'],
                ['done--69-3'],
                ['start-70-3'],
                ['done--70-3'],
                ['start-71-3'],
                ['done--71-3'],
            ]);
        });

        it('should only wait for the given properties', async () => {
            await Promise.all([
                enqueued(42, 1),
                enqueued(42, 2),
                enqueued(69, 1),
            ]);

            expect(cb.mock.calls).toEqual([
                ['start-42-1'],
                ['done--42-1'],
                ['start-42-2'],
                ['start-69-1'],
                ['done--42-2'],
                ['done--69-1'],
            ]);
        });
    });
});

describe(handleSequentially, () => {
    let id = 0;
    beforeEach(() => id = 0);
    const handler = jest.fn();

    describe.each`
    type            | grouper
    ${'grouped'}    | ${(req: import('express').Request) => req.body.group}
    ${'non-grouped'}| ${undefined}
    `('using the middleware `$type`', ({ type, grouper }) => {
        const router = Router();
        router.post('/endPoint', handleSequentially(grouper), handler);

        const server = new MockServer(router, {
            method: 'POST',
            url: '/endPoint',
            body: () => ({ group: 1, id: id++ }),
        });

        it('should still call the request', async () => {
            const p = server.post();
            await finishRequest(0);
            await expect(p).resolves.toEqual({ group: 1, id: 0 });
        });

        it('should call the handlers sequentially in order', async () => {
            const p0 = server.post();
            const p1 = server.post();
            const p2 = server.post();

            // Wait for all the internal Promises to have been resolved
            await milliseconds();

            expect(handler).toHaveBeenCalledTimes(1);
            await finishRequest(0);
            await expect(p0).resolves.toEqual({ group: 1, id: 0 });

            // The second request should now start being handled, but not the third
            expect(handler).toHaveBeenCalledTimes(2);
            await finishRequest(1);
            await expect(p1).resolves.toEqual({ group: 1, id: 1 });
            await finishRequest(2);
            await expect(p2).resolves.toEqual({ group: 1, id: 2 });
        });

        if (type === 'grouped') {
            it('should group requests together and only handle those sequentially', async () => {
                const p0 = server.post({ body: { group: 1, id: 0 } });
                const p1 = server.post({ body: { group: 1, id: 1 } });
                const p2 = server.post({ body: { group: 2, id: 2 } });

                // Wait for all the internal Promises to have been resolved
                await milliseconds();

                // Both the first and third request should have been called
                expect(handler).toHaveBeenCalledTimes(2);
                // Handler 1 should be request p2, since the second handler should not have been called yet
                await finishRequest(1);
                await expect(p2).resolves.toEqual({ group: 2, id: 2 });

                // After finishing request 2, request 1 still should not start
                expect(handler).toHaveBeenCalledTimes(2);

                await finishRequest(0);
                await expect(p0).resolves.toEqual({ group: 1, id: 0 });

                expect(handler).toHaveBeenCalledTimes(3);
                await finishRequest(2);
                await expect(p1).resolves.toEqual({ group: 1, id: 1 });
            });
        } else {
            it('should handle all requests sequentially, despite any group', async () => {
                const p0 = server.post({ body: { group: 1, id: 0 } });
                const p1 = server.post({ body: { group: 2, id: 1 } });
                const p2 = server.post({ body: { group: 1, id: 2 } });

                // Wait for all the internal Promises to have been resolved
                await milliseconds();

                expect(handler).toHaveBeenCalledTimes(1);
                await finishRequest(0);
                await expect(p0).resolves.toEqual({ group: 1, id: 0 });

                // The second request should now start being handled, but not the third
                expect(handler).toHaveBeenCalledTimes(2);
                await finishRequest(1);
                await expect(p1).resolves.toEqual({ group: 2, id: 1 });
                await finishRequest(2);
                await expect(p2).resolves.toEqual({ group: 1, id: 2 });
            });
        }
    });

    async function finishRequest(index: number) {
        await milliseconds();
        const [req, res] = handler.mock.calls[index];
        res.status(200).json(req.body);
        // Wait for all the internal Promises to have been resolved
        await milliseconds();
    }
});

function milliseconds(ms = 0) {
    return new Promise(r => setTimeout(r, ms));
}
