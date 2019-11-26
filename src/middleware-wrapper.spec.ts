import { wrapMiddleware } from './middleware-wrapper';

describe(wrapMiddleware, () => {
    const handler = jest.fn();
    const wrappedHandler = wrapMiddleware(handler);
    const next = jest.fn();
    const req = {} as any;
    let res: any;
    beforeEach(() => {
        res = {
            finished: false,
            status: jest.fn(),
            json: jest.fn(),
        };
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
