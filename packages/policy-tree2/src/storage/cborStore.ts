import {Repo, IDataStore, IKey, Key, Query} from './repo'

const dagCBOR = require('ipld-dag-cbor')

export class CborStore {
    private datastore:IDataStore
    private namespace?:IKey

    constructor(repo:Repo, namespace?:string) {
        this.datastore = repo.datastore
        if (namespace) {
            this.namespace = new Key(namespace)
        }
    }

    private namespacedKey(strKey:string) {
        let dKey = new Key(strKey)
        if (this.namespace) {
            dKey = this.namespace.child(dKey)
        }
        return dKey
    }

    private denamespacedKey(key:IKey) {
        let keyStr = key.toString().slice(this.namespace.toString().length)
        return new Key(keyStr)
    }

    put(key:string, val:any) {
        const dKey = this.namespacedKey(key)
        const bits = dagCBOR.util.serialize(val)
        return this.datastore.put(dKey, bits)
    }

    async get<T=any>(key:string):Promise<T> {
        const dKey = this.namespacedKey(key)
        try {
            const bits = await this.datastore.get(dKey)
            return dagCBOR.util.deserialize(bits)
        } catch(err) {
            if (err.message.includes("Not Found")) {
                return undefined
            }
            console.error(`err getting (${key}): `, err)
            throw err
        }
    }

    async * query<T=any>(query:Query):AsyncIterable<{key: IKey, value: T}> {
        if (this.namespace && query.prefix) {
            query.prefix = this.namespace.concat(new Key(query.prefix)).toString()
        }
        for await (const x of this.datastore.query(query)) {
            let key = x.key
            const value = dagCBOR.util.deserialize(x.value)
            if (this.namespace) {
                key = this.denamespacedKey(key)
            }
            yield {key: key, value: value}
        }
    }

}