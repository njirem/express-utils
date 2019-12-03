import * as all from '../index';
import * as srcAll from './index';

describe('index.js test', () => {
    it('should import something', () => expect(all).toBeTruthy());

    // Need to build before this succeeds!!
    it('should have the same exports as src/index', () => {
        expect(Object.keys(all)).toEqual(Object.keys(srcAll));
    });
});
