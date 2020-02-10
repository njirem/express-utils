import { MapWithDefault } from './MapWithDefault';

describe(MapWithDefault, () => {
    let map: MapWithDefault<string, any>;
    beforeEach(() => map = new MapWithDefault(key => ({ key })));

    it('should be able to set and get a value', () => {
        map.set('hoi', 'anything');
        expect(map.get('hoi')).toBe('anything');
    });

    it('should be able to bypass the factory function', () => {
        expect(map.get('foo', true)).toBe(undefined);
        expect(map.size).toBe(0);
    });

    it('should be able to ask if a value exists', () => {
        expect(map.has('foo')).toBe(false);
        map.set('foo', 'bar');
        expect(map.has('foo')).toBe(true);
    });

    it('should create a value if it is not available', () => {
        expect(map.has('someKey')).toBe(false);
        expect(map.get('someKey')).toEqual({ key: 'someKey' });
        expect(map.has('someKey')).toBe(true);
        map.get('someKey').key = 'otherValue';
        expect(map.get('someKey')).toEqual({ key: 'otherValue' });
    });

    it('should be able to delete a value', () => {
        map.set('hoihoi', 'anything');
        expect(map.has('hoihoi')).toBe(true);
        expect(map.get('hoihoi')).toBe('anything');
        map.delete('hoihoi');
        expect(map.has('hoihoi')).toBe(false);
        expect(map.get('hoihoi')).toEqual({ key: 'hoihoi' });
    });

    it('should not create a value if it is set to `undefined`', () => {
        map.set('key', undefined);
        expect(map.has('key')).toBe(true);
        expect(map.get('key')).toBe(undefined);
    });

    describe('as Map', () => {
        it('should identify as a Map', () => {
            expect(map).toEqual(expect.any(Map));
        });

        it('should be able to iterate as a regular Map', () => {
            map.set('foo', { key: 'bar' });
            map.get('baz');
            expect(Array.from(map)).toEqual([
                ['foo', { key: 'bar' }],
                ['baz', { key: 'baz' }],
            ]);
        });

        it('should update size correctly', () => {
            expect(map.size).toBe(0);
            map.get('foo');
            expect(map.size).toBe(1);
            map.delete('foo');
            expect(map.size).toBe(0);
        });

        it('should be able to be prefilled as a Map', () => {
            const filled = new MapWithDefault((key: string) => key + key, [['foo', 'bar']]);
            expect(filled.get('foo')).toBe('bar');
            expect(filled.get('baz')).toBe('bazbaz');
        });
    });
});
