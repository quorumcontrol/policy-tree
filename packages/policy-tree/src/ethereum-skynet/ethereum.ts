import { providers, Contract, Event, Signer } from 'ethers'
import simpleStorage from './SimpleStorage.json'
import debug from 'debug'
import Repo from '../repo/repo'
import { GenesisOptions, MESSAGE_ACCOUNT_KEY, PolicyTree } from '../policytree'
import { HashMap, serialize, deserialize } from '../hashmap'
import { uploadBuffer, downloadFile } from '../skynet/skynet'
import { Transition, TransitionSet } from '../transitionset'

const log = debug('ethereum')

export const provider = new providers.JsonRpcProvider()
export const signer = provider.getSigner()
export const contract = new Contract(simpleStorage.networks['5777'].address, simpleStorage.abi, signer)

export class EthereumBack {
    repo: Repo

    constructor(repo: Repo) {
        this.repo = repo
    }

    async createAsset(genesis: GenesisOptions): Promise<[string]> {
        const hshMp = await HashMap.create(this.repo.blocks)
        await hshMp.set('genesis', genesis)

        const siaUrl = await uploadBuffer(await serialize(hshMp, this.repo.blocks))
        log("siaUrl: ", siaUrl)

        const sendingAddress = signer.getAddress()
        const bloom = hshMp.cid.multihash.slice(2) // first 2 bytes are codec and length
        const resp = await contract.log(bloom, Buffer.from(siaUrl))
        log("create resp: ", resp)
        return [`did:eth:${resp.blockNumber}-${await sendingAddress}-${resp.hash}`]
    }

    /**
     * messageAsset is a two step process. First, create a transaction with the transition you want
     * and then send a transaction to the assets message queue account with a data item of the transition.
     * @param did 
     * @param trans 
     */
    async messageAsset(did: string, trans: Transition) {
        const tree = await this.getAsset(did)
        const messageQueueAccount = await tree.get(MESSAGE_ACCOUNT_KEY)
        if (!messageQueueAccount) {
            throw new Error("asset must allow messaging")
        }

        // first we create a transition to the asset in our *own* account
        const resp = await this.transitionAsset(did, trans)

        log("building messaging transaction: ")
       
        // log("submitting transaction: ", transaction)
        // return server.submitTransaction(transaction)
    }

    async transitionAsset(did: string, trans: Transition) {

        log("transitioning asset: ", did, trans)
        const hshMp = await HashMap.create(this.repo.blocks)
        await hshMp.set(did, trans)

        const buf = await serialize(hshMp, this.repo.blocks)
        const siaUrl = await uploadBuffer(buf)
        log("uploaded serialized hashmap: ", siaUrl)
        
        const bloom = hshMp.cid.multihash.slice(2) // first 2 bytes are codec and length
        return await contract.log(bloom, Buffer.from(siaUrl))
    }

    private async getLocal(did: string) {
        const tree = new PolicyTree(    did, this.repo)

        if (await tree.exists()) {
            return tree
        }

        return undefined
    }

    private getEventsFrom(height:number) {
        return contract.queryFilter({}, height)
    }

    async getAsset(did: string) {
        log("get asset: ", did)
        const idParts = did.split(':')[2] // comes in the format did:eth:${resp.blockNumber}-${sendingAddress}-${resp.transactionHash}
        const [blockNumberStr,sendingAddress,transHash] = idParts.split('-')
        const blockNumber = parseInt(blockNumberStr, 10)
        const filter = contract.filters.Transition(sendingAddress)
        const transitions = await contract.queryFilter(filter, blockNumber, blockNumber)
        log("transitions in block: ", transitions)

        const genesisTrans = transitions.find((t)=> (t.transactionHash === transHash))
        log("genesis: ", genesisTrans)
        if (!genesisTrans) {
            throw new Error("Not Found: " + genesisTrans)
        }
        let tree: PolicyTree
        const localTree = await this.getLocal(did)
        if (localTree) {
            tree = localTree
        } else {
            const mp = await this.transactionToHashMap(genesisTrans)
            const genesis = await mp.get('genesis')
            tree = await PolicyTree.create(this.repo, did, genesis)
        }

        return this.playTransactions(tree, did, await this.getEventsFrom(blockNumber + 1))
    }

    private async transactionToHashMap(trans: Event):Promise<HashMap|null> {
        const siaUrl:string = Buffer.from(trans.args.transition.slice(2), 'hex').toString('utf-8')
        const mpBits = await downloadFile(siaUrl)
        return deserialize(this.repo.blocks, mpBits)
    }

    private async playTransactions(tree: PolicyTree, did: string, transactions: Event[]): Promise<PolicyTree> {
        log("play transactions: ", transactions)
        // if we have no transactions here it means we've reached the end of paging
        if (transactions.length === 0) {
            return tree
        }
        // get the latest and if the latest exists than make sure these transactions are greater 
        const latest = await tree.lastTransitionSet()

        // go through all the transactions and if none of them are more recent, just move onto the next one

        const transitionsByBlockHeight: { [key: number]: Transition[] } = {}

        for (const tran of transactions) {
            if (latest && tran.blockNumber <= latest.height ) {
                // if this transaction has already been included, we can skip it
                continue
            }
            const mp = await this.transactionToHashMap(tran)
            const transition = await mp.get(did)
            if (!transition) {
                continue
            }
            transition.sender = tran.args._from

            let existing = transitionsByBlockHeight[tran.blockNumber]
            existing = existing || []
            existing.push(transition)
            transitionsByBlockHeight[tran.blockNumber] = existing
        }

        const sortedKeys = Object.keys(transitionsByBlockHeight).sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10)).map((k) => parseInt(k, 10))

        const sets = sortedKeys.map((key: number) => {
            return new TransitionSet({
                source: "eth",
                height: key,
                transitions: transitionsByBlockHeight[key],
            })
        })

        for (let set of sets) {
            log("applying set")
            await tree.applySet(set)
        }

        const nextEvents = await this.getEventsFrom(sortedKeys[sortedKeys.length - 1] + 1)
        return this.playTransactions(tree, did, nextEvents)
    }
}
