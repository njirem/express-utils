import { MapWithDefault } from './MapWithDefault';

/** If the groupPicker returns this Symbol, the function/middleware will be executed directly, despite any queue */
export const HANDLE_DIRECTLY: unique symbol = Symbol('handle directly');
type Primitive = string | number | void | null | boolean | symbol;
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
export function enqueueExecution<Fn extends (this: any, ...args: any[]) => Promise<any>, K extends Primitive>(
    fn: Fn,
    groupPicker: (this: ThisParameterType<Fn>, ...args: Parameters<Fn>) => K | K[] | typeof HANDLE_DIRECTLY = () => undefined as any,
    activeExecutionsCache = createActiveExecutionsQueue<K>(),
) {
    return async function (...args: Parameters<Fn>) {
        const group = groupPicker.apply(this, args);
        // Bypass option
        if (group === HANDLE_DIRECTLY) { return fn.apply(this, args); }

        const keys = Array.isArray(group) ? group : [group];
        const res = Promise.all(keys.map(key => activeExecutionsCache.get(key))).then(() => fn.apply(this, args));
        const prom = res.catch(() => { /** Catch any errors */ }).then(() => {
            for (const key of keys) {
                // Get the key with 'noDefault', to not create a Promise if the key doesn't exist anymore
                if (activeExecutionsCache.get(key, true) === prom) {
                    activeExecutionsCache.delete(key);
                }
            }
        });
        for (const key of keys) {
            activeExecutionsCache.set(key, prom);
        }
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
export function handleSequentially<K extends Primitive>(
    groupBy?: (req: import('express').Request) => K | K[] | typeof HANDLE_DIRECTLY,
    activeExecutionsCache?: ExecutionQueue<K>
): import('express').Handler {
    return enqueueExecution(async (_req, res, start) => {
        start();
        return new Promise(r => {
            res.once('finish', r);
            res.once('close', r);
        });
    }, groupBy, activeExecutionsCache);
}

/** Creates a cache that can be used in `enqueueExecution` or `handleSequentially` to group multiple functions together */
export function createActiveExecutionsQueue<T>(): ExecutionQueue<T> {
    return new MapWithDefault<T, Promise<void>>(() => Promise.resolve());
}

type ExecutionQueue<T> = MapWithDefault<T, Promise<void>>;
