import { HttpError } from './HttpError';

/**
 * Will construct a middleware handler, that checks if the user in the request has the given scopes (with the addition of the prefix/postfix).
 * It will throw a Http 403 if one or more scopes are missing, if no scope information is found, it will throw a 401.
 *
 * This middleware assumes scopes are found under: Request.authInfo.scopes.
 *
 * @param mapperOrFirstScope The mapper for the required scopes so that generic prefixes can be ignored
 * @param scopes The required scopes for this route
 */
export function assertUserHasScopes(...scopes: string[]): import('express').Handler;
export function assertUserHasScopes(mapper: ((scope: string) => string), ...scopes: string[]): import('express').Handler;
export function assertUserHasScopes(mapperOrFirstScope?: string | ((scope: string) => string), ...scopes: string[]): import('express').Handler {
    if (typeof mapperOrFirstScope === 'string') {
        scopes.unshift(mapperOrFirstScope);
    }
    const requiredScopes = typeof mapperOrFirstScope === 'function' ? scopes.map(mapperOrFirstScope) : scopes;

    return (req, _res, next) => {
        const userScopes = req.authInfo && req.authInfo.scopes;
        if (!userScopes) { throw new HttpError(401, 'Did not receive enough authorization information to determine access rights.'); }
        // If all required scopes are included in the user scopes, everything is good and we can continue processing the request
        if (requiredScopes.every(requiredScope => userScopes.includes(requiredScope))) { return next(); }

        const internal = requiredScopes.filter(scope => !userScopes.includes(scope));
        const readable = internal.map(s => scopes[requiredScopes.indexOf(s)]);
        throw new HttpError(403,
            `Missing scope${internal.length === 1 ? '' : 's'}: ${readable.join(', ')}`,
            { requiredScopes, userScopes, missingScopes: { internal, readable } }
        );
    };
}

declare global {
    namespace Express {
        // tslint:disable-next-line:no-empty-interface
        interface AuthInfo {
            scopes?: string[];
        }
    }
}
