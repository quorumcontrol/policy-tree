import CID from 'cids'
import { makeBlock, IBlock, decodeBlock } from './repo/block'
import Policy from './policy'
import debug from 'debug'
import {Transition, TransitionSet,CanonicalTransitionSet} from './transitionset'

const log = debug("PolicyTree")

export const notAllowedErr = "TRANSACTION_NOT_ALLOWED"

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

interface KeyValuePair {
    key: string
    value: any
}

interface PolicyResponse {
    allow: boolean
    pairs: KeyValuePair[]
    needs?: {
        keys: string[]
    } 
}

export interface GenesisOptions {
    policy?: CID
    metadata?:any
}

// for now it's any
type BlockStore = any

const POLICY_KEY = "/policy"
const GENESIS_KEY = "/genesis"

type PolicyInput = Transition & {
    keys?: {[key:string]:any}
}

export class PolicyTree {
    hashMap:Promise<ImmutableMap>
    store:BlockStore
    private policy?:Promise<Policy>

    static async create(store:BlockStore, opts:GenesisOptions = {}) {
        const genesisBlock = await makeBlock(opts)
        store.put(genesisBlock)
        const tree = new PolicyTree(store)
        await tree.set(GENESIS_KEY, opts)
        await tree.set(POLICY_KEY, opts.policy)
        return tree
    }

    constructor(store:BlockStore,tip?:CID) {
        this.hashMap = HashMap.create(store,tip)
        this.store = store
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

    async applySet(set:TransitionSet) {
        // look up the current, if that is higher than what's being tried here than throw
        const currentCid = await this.get('/transition-sets/current')
        if (currentCid) {
            const blk:IBlock = await this.store.get(currentCid)
            const canonicalObj = await decodeBlock<CanonicalTransitionSet>(blk)
            if (canonicalObj.height >= set.height) {
                throw new Error("block already applied")
            }
        }
        const transitions = await set.transitions()
        // apply the transitions in order, if one fails then just skip over it.
        for(const transition of transitions) {
            try {
                await this.transition({...transition, height: set.height})
            } catch(err) {
                if(err.message !== notAllowedErr) {
                    throw err
                }
                // otherwise do nothing and continue (ignoring the transition)
            }
        }
        const setObj = await set.toCanonicalObject()
        const key = `/transition-sets/${set.height}`
        setObj.previous = key
        const setBlock = await makeBlock(setObj)

        this.store.put(setBlock)
        // we now have an updated tree, let's save some metadata
        await this.set(`/transition-sets/current`, setBlock.cid)
        await this.set(key, setBlock.cid)
    }

    // TODO: this is never invalidated, so if a policy lets you modify a policy
    // this needs to be invalidated
    private fetchPolicy() {
        if (this.policy) {
            return this.policy
        }
        this.policy = new Promise(async (resolve) => {
            const hshMap = await this.hashMap
            const policyCID = await hshMap.get<CID|undefined>(POLICY_KEY)
            if (!policyCID) {
                throw new Error("no transitions defined")
            }

            const policyBlock:IBlock = await this.store.get(policyCID)

            resolve(new Policy(policyBlock))
        })
        return this.policy
    }

    async transition(trans:Transition) {
        const hshMap = await this.hashMap
        const policy = await this.fetchPolicy()

        let input:PolicyInput = {...trans}
        log("transition: ", trans)
        let res = await policy.evaluate<PolicyResponse>(input)
        log("res: ", res, ' from transition: ', input)

        // if the policy returns a needs key then we will give the policy
        // the information it needs
        // for now only *local* keys are available, but it should include things like the state
        // of other objects in the network
        if (res.needs) {
            const valPromises:{[key:string]:Promise<any>} = {}
            for(const key of res.needs.keys) {
                valPromises[key] = hshMap.get(key)
            }
            const vals:(PolicyInput["keys"]) = {}
            for(const key of res.needs.keys) {
                vals[key] = await valPromises[key]
            }
            input.keys = vals
            res = await policy.evaluate<PolicyResponse>(input)
            log("updated res: ", res, ' from transition: ', input)
        }

        if (!res.allow) {
            throw new Error(notAllowedErr)
        }

        for(const pair of res.pairs) {
            await hshMap.set(pair.key, pair.value)
            if (pair.key === POLICY_KEY) {
                this.policy = undefined
            }
        }
    }
}