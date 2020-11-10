import { ICborStore } from "./cborStore";
import { VersionStore } from "./versionstore";

export class Transaction implements ICborStore {

    private versionedStore: VersionStore
    pending:{[key:string]:any}
    height:number

    constructor(store:VersionStore, height:number) {
        this.versionedStore = store
        this.height = height
        this.pending = {}
    }

    async commit() {
        for(let key of Object.keys(this.pending)) {
            await this.versionedStore.put(key, this.pending[key])
        }
        return this.versionedStore.snapshot(this.height)
    }

    has(key:string) {
        if (this.pending[key]) {
            return Promise.resolve(true)
        }
        return this.versionedStore.has(key)
    }

    get(key:string) {
        if (this.pending[key]) {
            return Promise.resolve(this.pending[key])
        }
        return this.versionedStore.get(key)
    }

    put(key:string, val:any) {
        this.pending[key] =  val
        return Promise.resolve(true)
    }

}