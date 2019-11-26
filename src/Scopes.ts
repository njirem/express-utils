import { HttpError } from './HttpError';

export class Scopes {
    constructor(private readonly prefix = '', private readonly postfix = '') { }

    private fullScope(scope: string) { return this.prefix + scope + this.postfix; }
    private readableScope(scope: string) { return scope.slice(this.prefix.length, -this.postfix.length || undefined); }

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

declare global {
    namespace Express {
        // tslint:disable-next-line:no-empty-interface
        interface AuthInfo {
            scopes?: string[];
        }
    }
}
