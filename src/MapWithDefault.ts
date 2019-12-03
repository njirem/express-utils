
export class MapWithDefault<K, V> {
    private readonly map = new Map<K, V>();
    constructor(private readonly factory: (key: K) => V) { }

    get(key: K) {
        if (!this.map.has(key)) {
            this.map.set(key, this.factory(key));
        }
        return this.map.get(key)!;
    }

    set(key: K, value: V) { return this.map.set(key, value); }

    has(key: K) { return this.map.has(key); }

    delete(key: K) { return this.map.delete(key); }
}
