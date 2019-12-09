import { assertUserHasScopes } from './scopes';

describe(assertUserHasScopes, () => {
    const res = {} as unknown as import('express').Response;
    const next = jest.fn();
    function req(scopes?: string[]) {
        return { authInfo: { scopes } } as unknown as import('express').Request;
    }

    describe('without a mapper', () => {
        it('should not handle a request without scopes', () => {
            expect(() => assertUserHasScopes()(req(), res, next))
                .toThrow('Did not receive enough authorization information to determine access rights.');

            expect(() => assertUserHasScopes('foo')(req(), res, next))
                .toThrow('Did not receive enough authorization information to determine access rights.');
        });

        it('should check for a single required scope', () => {
            assertUserHasScopes('foo')(req(['foo']), res, next);
            expect(next).toHaveBeenCalled();

            expect(() => assertUserHasScopes('foo')(req([]), res, next))
                .toThrow('Missing scope: foo');
        });

        it('should check for multiple required scopes', () => {
            assertUserHasScopes('foo', 'bar')(req(['foo', 'bar']), res, next);
            expect(next).toHaveBeenCalled();

            expect(() => assertUserHasScopes('foo', 'bar')(req(['foo']), res, next))
                .toThrow('Missing scope: bar');

            expect(() => assertUserHasScopes('foo', 'bar')(req([]), res, next))
                .toThrow('Missing scopes: foo, bar');
        });
    });

    describe('with a mapper', () => {
        const checkScopes = assertUserHasScopes.bind(null, s => `${s}.${s}`);

        it('should be able to handle a request without scopes', () => {
            expect(() => checkScopes()(req(), res, next))
                .toThrow('Did not receive enough authorization information to determine access rights.');

            expect(() => checkScopes('foo')(req(), res, next))
                .toThrow('Did not receive enough authorization information to determine access rights.');
        });

        it('should check for a single required scope', () => {
            checkScopes('foo')(req(['foo.foo']), res, next);
            expect(next).toHaveBeenCalled();

            expect(() => checkScopes('foo')(req([]), res, next))
                .toThrow('Missing scope: foo');
        });

        it('should check for multiple required scopes', () => {
            checkScopes('foo', 'bar')(req(['foo.foo', 'bar.bar']), res, next);
            expect(next).toHaveBeenCalled();

            expect(() => checkScopes('foo', 'bar')(req(['foo.foo']), res, next))
                .toThrow('Missing scope: bar');

            expect(() => checkScopes('foo', 'bar')(req([]), res, next))
                .toThrow('Missing scopes: foo, bar');
        });
    });

});
