import { MapWithDefault } from './MapWithDefault';

describe(MapWithDefault, () => {
    let map: MapWithDefault<string, any>;
    beforeEach(() => map = new MapWithDefault(key => ({ key })));

    it('should be able to set and get a value', () => {
        map.set('hoi', 'anything');
        expect(map.get('hoi')).toBe('anything');
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
});
