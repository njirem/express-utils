import { Scopes } from './Scopes';

describe(Scopes, () => {
    const res = {} as unknown as import('express').Response;
    const next = jest.fn();
    function req(scopes?: string[]) {
        return { authInfo: { scopes } } as unknown as import('express').Request;
    }

    it('should be able to create a checker', () => {
        const s = new Scopes;
        expect(s).toBeTruthy();
        expect(s.assertRequired).toEqual(expect.any(Function));
    });

    describe('with no pre-/postfix', () => {
        const scopes = new Scopes();

        it('should throw an error if no scope information is present', () => {
            expect(() => scopes.assertRequired('myScope')(req(), res, next))
                .toThrow(
                    expect.objectContaining({
                        code: 401,
                        message: 'Did not receive enough authorization information to determine access rights.',
                    }),
                );
        });

        it('should return an HttpError if the requested scope is not present in the request', () => {
            expect(() => scopes.assertRequired('myScope')(req([]), res, next))
                .toThrow(
                    expect.objectContaining({
                        code: 403,
                        message: 'Missing scope: myScope',
                    }),
                );
        });

        it('should return an HttpError if multiple scopes are not present in the request', () => {
            expect(() => scopes.assertRequired('myScope', 'otherScope', 'presentScope')(req(['presentScope']), res, next))
                .toThrow(
                    expect.objectContaining({
                        code: 403,
                        message: 'Missing scopes: myScope, otherScope',
                    }),
                );
        });

        it('should call next if all scopes are found', () => {
            scopes.assertRequired('myScope', 'presentScope')(req(['myScope', 'presentScope']), res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('with prefix/postfix', () => {
        const scopes = new Scopes('prefix.', '.postfix');

        it('should accept the given scope with prefix and postfix', () => {
            scopes.assertRequired('myScope')(req(['prefix.myScope.postfix']), res, next);
            expect(next).toHaveBeenCalled();

            expect(() => scopes.assertRequired('myScope', 'presentScope')(req(['prefix.myScope.postfix']), res, next))
                .toThrow(
                    expect.objectContaining({
                        code: 403,
                        message: 'Missing scope: presentScope',
                    })
                );
        });

        it('should not accept a scope without the prefix or postfix', () => {
            expect(() => scopes.assertRequired('myScope')(req(['myScope']), res, next))
                .toThrow(
                    expect.objectContaining({
                        code: 403,
                        message: 'Missing scope: myScope',
                    }),
                );
        });
    });
});
