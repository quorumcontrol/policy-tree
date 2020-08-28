import {Repo, IDataStore, IKey, Key} from './repo'

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
}