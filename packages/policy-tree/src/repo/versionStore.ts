import {enablePatches} from "immer"
import {Repo, IDataStore, IKey, Key} from './repo'
enablePatches()
import {produceWithPatches} from "immer"

type StateDoc = {[key:string]:any}
type CurrDoc = {
    height:number,
    state: StateDoc,
}


export class VersionStore {
    private datastore:IDataStore
    private namespace?:IKey
    private current:Promise<CurrDoc>

    constructor(repo:Repo, namespace?:string) {
        this.datastore = repo.datastore
        if (namespace) {
            this.namespace = new Key(namespace)
        }
        this.current = this.getCurrent()
    }

    async update(updater:(doc:StateDoc)=>StateDoc, height:number) {
        const [nextState, patches, inversePatches] = produceWithPatches(
            await this.current,
            updater,
        )
        this.current = Promise.resolve({
            height: height,
            state: nextState,
        })
        await Promise.all([
            this.put('current', {
                height: height,
                state: nextState,
            }),
            this.put(`${height}/patches`, {
                patches: patches,
                inversePatches: inversePatches,
            }),
            this.put(height.toString(), {
                nextState,
            })
        ])
    }

    async get(key:string) {
        const curr = await this.current
        return curr.state[key]
    }

    private namespacedKey(strKey:string) {
        let dKey = new Key(strKey)
        if (this.namespace) {
            dKey = this.namespace.child(dKey)
        }
        return dKey
    }

    private async getCurrent() {
        const curr = await this.getRepo<CurrDoc>('current')
        return curr ? curr : {state: {}, height: 0}
    }

    private put(key:string, val:any) {
        const dKey = this.namespacedKey(key)
        const bits = JSON.stringify(val)
        return this.datastore.put(dKey, Buffer.from(bits))
    }

    private async getRepo<T=any>(key:string):Promise<T> {
        const dKey = this.namespacedKey(key)
        try {
            const bits = await this.datastore.get(dKey)
            return JSON.parse(Buffer.from(bits).toString())
        } catch(err) {
            if (err.message.includes("Not Found")) {
                return undefined
            }
            console.error(`err getting (${key}): `, err)
            throw err
        }
    }
}