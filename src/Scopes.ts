import { HttpError } from './HttpError';

/** A class that can be used to set a prefix/postfix to your scope check. */
export class Scopes {
    constructor(private readonly prefix = '', private readonly postfix = '') { }

    private fullScope(scope: string) { return this.prefix + scope + this.postfix; }
    private readableScope(scope: string) { return scope.slice(this.prefix.length, -this.postfix.length || undefined); }

    /**
     * Will construct a middleware handler, that checks if the user in the request has the given scopes (with the addition of the prefix/postfix).
     * It will throw a Http 403 if one or more scopes are missing, if no scope information is found, it will throw a 401.
     *
     * This middleware assumes scopes are found under: Request.authInfo.scopes.
     */
    assertRequired(requiredScope: string, ...otherRequiredScopes: string[]): import('express').Handler;
    assertRequired(...scopes: string[]): import('express').Handler {
        const requiredScopes = scopes.map(scope => this.fullScope(scope));

        return (req, _res, next) => {
            const userScopes = req.authInfo && req.authInfo.scopes;
            if (!userScopes) { throw new HttpError(401, 'Did not receive enough authorization information to determine access rights.'); }
            // If all required scopes are included in the user scopes, everything is good and we can continue processing the request
            if (requiredScopes.every(requiredScope => userScopes.includes(requiredScope))) { return next(); }

            const missingScopes = requiredScopes.filter(scope => !userScopes.includes(scope));
            throw new HttpError(403,
                `Missing scope${missingScopes.length === 1 ? '' : 's'}: ${missingScopes.map(fullScope => this.readableScope(fullScope)).join(', ')}`,
                { requiredScopes, userScopes, missingScopes }
            );
        };
    }
}

const defaultInstance = new Scopes;
/**
 * Will construct a middleware handler, that checks if the user in the request has the given scopes.
 * It will throw a Http 403 if one or more scopes are missing, if no scope information is found, it will throw a 401.
 *
 * This middleware assumes scopes are found under: Request.authInfo.scopes.
 *
 * If all of the scopes use a prefix/postfix, you can use the `Scopes` class, to set these.
 */
export const assertRequired = defaultInstance.assertRequired.bind(defaultInstance);

declare global {
    namespace Express {
        // tslint:disable-next-line:no-empty-interface
        interface AuthInfo {
            scopes?: string[];
        }
    }
}
