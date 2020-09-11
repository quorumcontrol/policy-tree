import { enablePatches } from "immer"
import { Repo, IDataStore, IKey, Key } from './repo'
enablePatches()
import { produceWithPatches } from "immer"
import debug from 'debug'

const log = debug("VersionStore")

export type StateDoc = { [key: string]: any }
type CurrDoc = {
    previous?: number,
    height: number,
    state: StateDoc,
}

export class VersionStore {
    private datastore: IDataStore
    private namespace?: IKey
    current: Promise<CurrDoc>

    constructor(repo: Repo, namespace?: string) {
        this.datastore = repo.datastore
        if (namespace) {
            this.namespace = new Key(namespace)
        }
        this.current = this.getCurrent()
    }

    // generally we want to have a height where store the current state, but it can be useful
    // to reconstruct an intermediate state... for instance if there are a block of transactions,
    // we want to know what the state was during a particular index in the block.
    async update(updater: (doc: StateDoc) => StateDoc, height: number) {
        try {
            const previous = await this.current
            const [nextStateP, patches, inversePatches] = produceWithPatches(
                (await this.current).state,
                updater,
            )

            const nextState = await nextStateP

            this.current = Promise.resolve({
                height: height,
                state: nextState,
                previous: previous.height,
            })
            await Promise.all([
                // TODO: if nothing has changed, no need to update all this
                this.put('current', height),
                // TODO: patches aren't necessary since we're using the full state,
                // but in the future it would be nice to just checkpoint the state
                // and keep these patches in between
                this.put(`patches/${height}`, {
                    patches: patches,
                    inversePatches: inversePatches,
                }),
                this.put(`states/${height}`, {
                    previous: previous.height,
                    state: nextState,
                })
            ])
        } catch(err) {
            console.error("error updating: ", err)
            throw err
        }
    }

    async height() {
        return (await this.current).height
    }

    async get<T=any>(key: string):Promise<T> {
        const curr = await this.current
        return curr.state[key]
    }

    // TODO: allow reverting to a state as well (for block reorgs)

    async stateAt(height:number) {
        log("getting state at height: ", height)
        if ((!height && height !== 0)|| height < 0) {
            throw new Error("height must be >= 0")
        }
        const current = await this.current
        if (height >= current.height) {
            return current.state
        }

        const traverser = async (h:number):Promise<StateDoc>=> {
            const doc = await this.getRepo<CurrDoc>(`states/${h}`)
            if (!doc) {
                // sometimes the zero height doc is undefined (not stored)
                // so just ship back an empty state
                return {}
            }
            log("traversing to previous: ", doc.previous)
            if (doc.previous >= height) {
                return traverser(doc.previous)
            }
            return doc.state
        }

        return traverser(current.previous)
    }

    private namespacedKey(strKey: string) {
        let dKey = new Key(strKey)
        if (this.namespace) {
            dKey = this.namespace.child(dKey)
        }
        return dKey
    }

    private async getCurrent() {
        const height = await this.getRepo<number>('current')
        const doc = await this.getRepo<CurrDoc>(`states/${height}`)
        return height ? {state: doc.state, height: height, previous: doc.previous} : { state: {}, height: 0, previous: undefined }
    }

    private put(key: string, val: any) {
        const dKey = this.namespacedKey(key)
        const bits = JSON.stringify(val)
        return this.datastore.put(dKey, Buffer.from(bits))
    }

    private async getRepo<T = any>(key: string): Promise<T> {
        const dKey = this.namespacedKey(key)
        try {
            const bits = await this.datastore.get(dKey)
            return JSON.parse(Buffer.from(bits).toString())
        } catch (err) {
            if (err.message.includes("Not Found")) {
                return undefined
            }
            console.error(`err getting (${key}): `, err)
            throw err
        }
    }
}