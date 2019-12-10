import { MapWithDefault } from './MapWithDefault';

/** If the groupPicker returns this Symbol, the function/middleware will be executed directly, despite any queue */
export const HANDLE_DIRECTLY: unique symbol = Symbol('handle directly');

/**
 * Function wrapper, that makes sure the function can't run twice at the same time.
 * Can be given an groupPicker function to group executions by that argument (on === equality).
 *
 * If given `activeExecutionsCache`, this function will not create a cache itself, but use the given cache instead.
 * This option can be used to execute multiple different functions sequentially on the same key.
 *
 * @param {(...args: T) => K | typeof HANDLE_DIRECTLY} [groupPicker] - Optional function that can return a key to group execution on
 * @param {MapWithDefault<K, Promise<void>>} [activeExecutionsCache] - Optional cache map, on which the executions are cached.
 */
export function enqueueExecution<Fn extends (this: any, ...args: any[]) => Promise<any>, K>(
    fn: Fn,
    groupPicker: (this: ThisParameterType<Fn>, ...args: Parameters<Fn>) => K | typeof HANDLE_DIRECTLY = () => undefined as any,
    activeExecutionsCache = createActiveExecutionsQueue<K>(),
) {
    return async function (...args: Parameters<Fn>) {
        const key = groupPicker.apply(this, args);
        // Bypass option
        if (key === HANDLE_DIRECTLY) { return fn.apply(this, args); }

        const res = activeExecutionsCache.get(key).then(() => fn.apply(this, args));
        const prom = res.catch(() => { }).then(() => {
            if (activeExecutionsCache.get(key) === prom) {
                activeExecutionsCache.delete(key);
            }
        });
        activeExecutionsCache.set(key, prom);
        return res;
    } as Fn;
}

/**
 * Middleware that can make sure only one of a certain request is handled at the same time.
 * The given function can return a parameter to group the requests by, so that only requests that need to wait on another are actually blocked.
 *
 * If given `activeExecutionsCache`, this function will not create a cache itself, but use the given cache instead.
 * This option can be used to execute multiple different functions sequentially on the same key.
 *
 * @template K
 * @param {(req: import('express').Request) => K | typeof HANDLE_DIRECTLY} [groupBy]
 * @param {MapWithDefault<K, Promise<void>>} [activeExecutionsCache] - Optional cache map, on which the executions are cached.\
 */
export function handleSequentially<K>(
    groupBy?: (req: import('express').Request) => K | typeof HANDLE_DIRECTLY,
    activeExecutionsCache?: ExecutionQueue<K>
): import('express').Handler {
    return enqueueExecution(async (_req, res, start) => {
        start();
        return new Promise(r => res.once('close', r));
    }, groupBy, activeExecutionsCache);
}

/** Creates a cache that can be used in `enqueueExecution` or `handleSequentially` to group multiple functions together */
export function createActiveExecutionsQueue<T>(): ExecutionQueue<T> {
    return new MapWithDefault<T, Promise<void>>(() => Promise.resolve());
}

type ExecutionQueue<T> = MapWithDefault<T, Promise<void>>;
