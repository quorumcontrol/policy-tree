import CID from 'cids'
import { makeBlock } from './repo/block'

const HashMap = require('./hashmap')
// A PolicyTree is a state machine. It starts from a genesis state that defines rules,
// then TransitionSets are played on top of the tree which modify the tree based on that
// genesis policy.

interface ImmutableMap {
    cid:CID
    set:(key:string,value:any)=>Promise<void>
    get:<T>(key:string)=>Promise<T>
    delete:(key:string)=>Promise<void>
}

interface Transition {
    type:string
    metadata:any
}

interface TransitionSet {
    height:number
    transitions:Transition[]
}

interface KeyValuePair {
    key: string
    value: any
}

interface PolicyResponse {
    allow: boolean
    pairs: KeyValuePair[]
}

export interface GenesisOptions {
    policy?: CID
    metadata?:any
}

// for now it's any
type BlockStore = any

export class PolicyTree {
    hashMap:Promise<ImmutableMap>

    static async create(store:BlockStore, opts:GenesisOptions = {}) {
        const genesisBlock = await makeBlock(opts)
        store.put(genesisBlock)
        const tree = new PolicyTree(store)
        await tree.set("/genesis", opts)
        await tree.set("/policy", opts.policy)
        return tree
    }

    constructor(store:BlockStore,tip?:CID) {
        this.hashMap = HashMap.create(store,tip)
    }

    private async set(key:string,value:any) {
        return (await this.hashMap).set(key,value)
    }

    async get<T=any>(key:string):Promise<T> {
        return (await this.hashMap).get(key)
    }

    async tip() {
        return (await this.hashMap).cid
    }
}