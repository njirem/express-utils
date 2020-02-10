
export class MapWithDefault<K, V> extends Map<K, V> {
    constructor(private readonly factory: (key: K) => V, entries?: Array<[K, V]>) { super(entries); }

    get(key: K, noDefault: true): V | undefined;
    get(key: K, noDefault?: false): V;
    get(key: K, noDefault?: boolean) {
        if (noDefault || this.has(key)) { return super.get(key); }
        const val = this.factory(key);
        this.set(key, val);
        return val;
    }
}
