import CID from 'cids'
import { makeBlock, IBlock } from './repo/block'
import {Policy} from './policy'
import debug from 'debug'
import {Transition, TransitionSet,CanonicalTransitionSet, TransitionTypes} from './transitionset'
import Repo from './repo/repo'
import { CborStore } from './repo/datastore'
import BigNumber from 'bignumber.js'

const log = debug("PolicyTree")

export const notAllowedErr = "TRANSACTION_NOT_ALLOWED"

// A PolicyTree is a state machine. It starts from a genesis state that defines rules,
// then TransitionSets are played on top of the tree which modify the tree based on that
// genesis policy.

export interface GenesisOptions {
    policy?: CID
    initialOwners?: string[]
    metadata?:{[key:string]:any}
}

export const POLICY_KEY = "/policy"
export const GENESIS_KEY = "/genesis"

interface PolicyTreeConstructorOpts {
    did: string
    repo: Repo
    universe?:{[key:string]:any}
}

export interface ReadOnlyTree {
    did:string,
    getData: PolicyTree['getData'],
    getPayment: PolicyTree['getPayment'],
    getBalance: PolicyTree['getBalance'],
    getMeta: PolicyTree['getMeta'],
    exists: PolicyTree['exists'],
}

export function canonicalTokenName(did:string, tokenName:string) {
    return `${did}-${tokenName}`
}

export class PolicyTree {
    repo:Repo
    did:string
    private dataStore:CborStore
    private valueStore:CborStore
    private metaStore:CborStore
    private policy?:Promise<Policy>
    universe?:{[key:string]:any}

    static async create(opts:PolicyTreeConstructorOpts, genesis:GenesisOptions = {}) {
        const genesisBlock = await makeBlock(genesis)
        opts.repo.blocks.put(genesisBlock)
        const tree = new PolicyTree(opts)
        await tree.setMeta(GENESIS_KEY, genesis)

        if (genesis.policy) {
            await tree.setData(POLICY_KEY, genesis.policy)
            await tree.transition({
                type: TransitionTypes.GENESIS,
                metadata: genesis,
            })    
        }
       
        return tree
    }

    constructor({did,repo, universe}:PolicyTreeConstructorOpts) {
        this.repo = repo
        this.did = did
        this.dataStore = new CborStore(this.repo, did)
        this.valueStore = new CborStore(this.repo, `${did}-value`)
        this.metaStore = new CborStore(this.repo, `${did}-meta`)
        this.universe = universe
    }

    async exists() {
        return !!(await this.getMeta(GENESIS_KEY))
    }

    async mint(tokenName:string, amount:BigNumber) {
        const key = canonicalTokenName(this.did, tokenName)
        const currentBalance = await this.getBalance(key)
        await this.valueStore.put(key, currentBalance.plus(amount).toString())
    }

    getPayment(canonicalTokenName:string, nonce:string) {
        return this.valueStore.get(`${canonicalTokenName}/sends/${nonce}`)
    }

    async sendToken(canonicalTokenName: string, dest:string, amount:BigNumber, nonce:string) {
        const currentBalance = await this.getBalance(canonicalTokenName)
        const paymentKey = `${canonicalTokenName}/sends/${nonce}`
        if (currentBalance.lt(amount)) {
            return false
        }
        if (await this.valueStore.get(paymentKey)) {
            return false
        }

        await this.valueStore.put(canonicalTokenName, currentBalance.minus(amount).toString())
        await this.valueStore.put(paymentKey, {dest, amount: amount.toString()})
    }

    async receiveToken(canonicalTokenName: string, nonce:string, otherTree:ReadOnlyTree) {
        const otherTreesPayment = await otherTree.getPayment(canonicalTokenName, nonce)
        if (!otherTreesPayment) {
            return false
        }
        // see if we've already received
        if (await this.valueStore.get(`${canonicalTokenName}/receives/${nonce}`)) {
            return false
        }
        // if not then write it out
        const currentBalance = await this.getBalance(canonicalTokenName)
        await this.valueStore.put(canonicalTokenName, currentBalance.plus(new BigNumber(otherTreesPayment.amount)).toString())
        await this.valueStore.put(`${canonicalTokenName}/receives/${nonce}`, otherTreesPayment)
    }

    async getBalance(canonicalTokenName:string):Promise<BigNumber> {
        const val = await this.valueStore.get(canonicalTokenName)
        return new BigNumber(val || 0)
    }

    setData(key:string,value:any) {
        return this.dataStore.put(key,value)
    }

    getData<T=any>(key:string):Promise<T> {
        return this.dataStore.get<T>(key)
    }

    setMeta(key:string,value:any) {
        return this.metaStore.put(key,value)
    }

    getMeta<T=any>(key:string):Promise<T> {
        return this.metaStore.get<T>(key)
    }

    async lastTransitionSet() {
        const canonicalTransition = await this.getMeta<CanonicalTransitionSet|undefined>('/transition-sets/current')
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
                if (err.message !== notAllowedErr) {
                    throw err
                }
                // otherwise do nothing and continue (ignoring the transition)
            }
        }
        const setObj = await set.toCanonicalObject()
        const key = `/transition-sets/${set.height}`
        setObj.previous = key

        // we now have an updated tree, let's save some metadata
        await this.setMeta(`/transition-sets/current`, setObj)
        await this.setMeta(key, setObj)
    }

    readOnly():ReadOnlyTree {
        const tree = this // for binding
        return harden({
            did: tree.did,
            getData: (key:string)=> {
                return tree.getData(key)
            },
            exists: ()=> {
                return tree.exists() 
            },
            getPayment: (canonicalTokenName:string, nonce:string)=> {
                return tree.getPayment(canonicalTokenName, nonce)
            },
            getMeta: (key:string)=> {
                return tree.getMeta(key)
            },
            getBalance: (canonicalTokenName: string) => {
                return tree.getBalance(canonicalTokenName)
            }
        })
    }

    // TODO: this is never invalidated, so if a policy lets you modify a policy
    // this needs to be invalidated
    private fetchPolicy() {
        if (this.policy) {
            return this.policy
        }
        this.policy = new Promise(async (resolve) => {
            const policyCID = await this.dataStore.get<CID|undefined>(POLICY_KEY)
            if (!policyCID) {
                throw new Error("no transitions defined")
            }

            const policyBlock:IBlock = await this.repo.blocks.get(policyCID)

            resolve(await Policy.create(policyBlock, this.universe))
        })
        return this.policy
    }

    // TODO: you should always use a set
    async transition(trans:Transition) {
        const policy = await this.fetchPolicy()

        log("transition: ", trans)
        let res = await policy.evaluate(this, trans)
        log("res: ", res, ' from transition: ', trans)
    }
}