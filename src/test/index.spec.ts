import * as all from '../../test-utils';
import * as srcAll from './index';

describe('index.js test', () => {
    it('should import something', () => expect(all).toBeTruthy());

    it('should have the same exports as src/index', () => {
        expect(Object.keys(all)).toEqual(Object.keys(srcAll));
    });
});
