import CID from 'cids'
import { makeBlock, IBlock } from '../repo/block'
import { Policy } from '../policy'
import debug from 'debug'
import { TransitionSet, TransitionTypes } from '../transitionset'
import Repo from '../repo/repo'
import { CborStore } from '../repo/datastore'
import { VersionStore, StateDoc } from '../repo/versionStore'
import { PolicyTreeVersion, ReadOnlyPolicyTreeVersion } from './policytreeversion'

const log = debug("PolicyTree")

export const notAllowedErr = "TRANSACTION_NOT_ALLOWED"

// A PolicyTree is a state machine. It starts from a genesis state that defines rules,
// then TransitionSets are played on top of the tree which modify the tree based on that
// genesis policy.

export interface GenesisOptions {
    policy?: CID
    policyLocator?: string // DID or sia url
    initialOwners?: string[]
    metadata?: { [key: string]: any }
}

export const POLICY_KEY = "/policy"
export const GENESIS_KEY = "/genesis"

interface PolicyTreeConstructorOpts {
    did: string
    repo: Repo
}

export class PolicyTree {
    repo: Repo
    did: string
    private dataStore: VersionStore
    // private valueStore:VersionStore
    private metaStore: CborStore
    private policy?: Promise<Policy>

    static async create(opts: PolicyTreeConstructorOpts, genesis: GenesisOptions = {}, universe?:any) {
        const genesisBlock = await makeBlock(genesis)
        opts.repo.blocks.put(genesisBlock)
        const tree = new PolicyTree(opts)
        await tree.setMeta(GENESIS_KEY, genesis)
        for (let key of Object.keys((genesis.metadata || {}))) {
            await tree.setMeta(key, genesis.metadata[key])
        }

        if (genesis.policy) {
            await tree.transact(0, async (version) => {
                await version.transition({
                    type: TransitionTypes.GENESIS,
                    metadata: genesis,
                }, universe)
                return true
            })
        }

        return tree
    }

    constructor({ did, repo }: PolicyTreeConstructorOpts) {
        this.repo = repo
        this.did = did
        this.dataStore = new VersionStore(repo, did)
        // this.valueStore = new VersionStore(this.repo, `${did}-value`)
        this.metaStore = new CborStore(repo, `${did}-meta`)
    }

    async transact(height: number, transactor: (tree: PolicyTreeVersion) => Promise<boolean>) {
        const curr = await this.dataStore.current
        if (height !== 0 && curr.height >= height) {
            throw new Error("can only transact at a higher height than current")
        }
        const policy = await this.fetchPolicy()

        await this.dataStore.update((async (doc: StateDoc) => {
            log("Updating: ", this.did)
            const version = new PolicyTreeVersion({ did: this.did, height: curr.height, policy: policy, state: doc, getMeta: this.getMeta.bind(this) })
            const res = await transactor(version)
            if (!res) {
                return undefined
            }
            return version.state
        }).bind(this), height)
        
        return true
    }

    async height() {
        return (await this.dataStore.current).height
    }

    async exists() {
        return !!(await this.getMeta(GENESIS_KEY))
    }

    async current(): Promise<PolicyTreeVersion> {
        const curr = await this.dataStore.current
        const policy = await this.fetchPolicy()
        return new PolicyTreeVersion({ did: this.did, height: curr.height, state: curr.state, policy: policy, getMeta: this.getMeta.bind(this) })
    }

    async at(height:number): Promise<ReadOnlyPolicyTreeVersion> {
        const state = await this.dataStore.stateAt(height)
        return new PolicyTreeVersion({ did: this.did, height: height, state: state, policy:null, getMeta: this.getMeta.bind(this) })
    }

    setMeta(key: string, value: any) {
        return this.metaStore.put(key, value)
    }

    getMeta<T = any>(key: string): Promise<T> {
        return this.metaStore.get<T>(key)
    }

    async applySet(set: TransitionSet, universe?:any) {
        const transitions = await set.transitions()
        await this.transact(set.height, async (version) => {
            for (const transition of transitions) {
                try {
                    await version.transition({ ...transition, height: set.height }, universe)
                } catch (err) {
                    if (err.message !== notAllowedErr) {
                        throw err
                    }
                    // otherwise do nothing and continue (ignoring the transition)
                }
            }
            return true
        })
        // apply the transitions in order, if one fails then just skip over it.

        const setObj = await set.toCanonicalObject()
        const key = `/transition-sets/${set.height}`
        setObj.previous = key

        // we now have an updated tree, let's save some metadata
        await this.setMeta(`/transition-sets/current`, setObj)
        await this.setMeta(key, setObj)
    }

    // TODO: this is never invalidated, so if a policy lets you modify a policy
    // this needs to be invalidated
    private fetchPolicy() {
        if (this.policy) {
            return this.policy
        }
        this.policy = new Promise(async (resolve) => {
            let policyCID = await this.dataStore.get<CID | undefined>(POLICY_KEY)
            if (!policyCID) {
                policyCID = (await this.metaStore.get<GenesisOptions>(GENESIS_KEY)).policy
                if (!policyCID) {
                    resolve(undefined)
                    return
                }
            }

            const policyBlock: IBlock = await this.repo.blocks.get(policyCID)

            resolve(await Policy.create(policyBlock))
        })
        return this.policy
    }

}