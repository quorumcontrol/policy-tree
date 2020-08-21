import CID from 'cids'
import { makeBlock, IBlock, decodeBlock } from './repo/block'
import Policy from './policy'
import debug from 'debug'
import {Transition, TransitionSet,CanonicalTransitionSet} from './transitionset'
import {HashMap} from './hashmap'
import Repo from './repo/repo'
import { CborStore } from './repo/datastore'

const log = debug("PolicyTree")

export const notAllowedErr = "TRANSACTION_NOT_ALLOWED"

// A PolicyTree is a state machine. It starts from a genesis state that defines rules,
// then TransitionSets are played on top of the tree which modify the tree based on that
// genesis policy.

// interface ImmutableMap {
//     cid:CID
//     set:(key:string,value:any)=>Promise<void>
//     get:<T>(key:string)=>Promise<T>
//     delete:(key:string)=>Promise<void>
// }

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
    messageAccount?:string
    initialOwner?: string
    metadata?:any
}


const POLICY_KEY = "/policy"
const GENESIS_KEY = "/genesis"
const OWNERSHIP_KEY = "/owners"
export const MESSAGE_ACCOUNT_KEY = "/message_account"

type PolicyInput = Transition & {
    keys?: {[key:string]:any}
}

export class PolicyTree {
    repo:Repo
    did:string
    private kvStore:CborStore
    private policy?:Promise<Policy>

    static async create(repo:Repo, did:string, genesis:GenesisOptions = {}) {
        const genesisBlock = await makeBlock(genesis)
        repo.blocks.put(genesisBlock)
        const tree = new PolicyTree(did, repo)
        await tree.set(GENESIS_KEY, genesis)
        await tree.set(POLICY_KEY, genesis.policy)
        await tree.set(OWNERSHIP_KEY, genesis.initialOwner ? [genesis.initialOwner] : [])
        await tree.set(MESSAGE_ACCOUNT_KEY, genesis.messageAccount)
        return tree
    }

    constructor(did:string, repo:Repo) {
        this.repo = repo
        this.kvStore = new CborStore(this.repo, did)
    }

    async exists() {
        return !!(await this.kvStore.get(GENESIS_KEY))
    }

    set(key:string,value:any) {
        return this.kvStore.put(key,value)
    }

    async get<T=any>(key:string):Promise<T> {
        return this.kvStore.get<T>(key)
    }

    async lastTransitionSet() {
        const canonicalTransition = await this.get<CanonicalTransitionSet|undefined>('/transition-sets/current')
        if (canonicalTransition) {
            return TransitionSet.fromCanonical(canonicalTransition)
        }
        return undefined
    }

    async applySet(set:TransitionSet) {
        // look up the current, if that is higher than what's being tried here than throw
        const lastSet = await this.lastTransitionSet()
        if (lastSet && lastSet.height >= set.height) {
            throw new Error("block already applied")
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

        // we now have an updated tree, let's save some metadata
        await this.set(`/transition-sets/current`, setObj)
        await this.set(key, setObj)
    }

    // TODO: this is never invalidated, so if a policy lets you modify a policy
    // this needs to be invalidated
    private fetchPolicy() {
        if (this.policy) {
            return this.policy
        }
        this.policy = new Promise(async (resolve) => {
            const policyCID = await this.kvStore.get<CID|undefined>(POLICY_KEY)
            if (!policyCID) {
                throw new Error("no transitions defined")
            }

            const policyBlock:IBlock = await this.repo.blocks.get(policyCID)

            resolve(new Policy(policyBlock))
        })
        return this.policy
    }

    // TODO: you should always use a set
    async transition(trans:Transition) {
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
                valPromises[key] = this.kvStore.get(key)
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
            await this.kvStore.put(pair.key, pair.value)
            if (pair.key === POLICY_KEY) {
                this.policy = undefined
            }
        }
    }
}