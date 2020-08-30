import { providers, Contract, Event, utils } from 'ethers'
import PolicyTreeTransitionContract from './PolicyTreeTransitions.json'
import debug from 'debug'
import Repo from '../repo/repo'
import { GenesisOptions, PolicyTree, ReadOnlyTree, GENESIS_KEY } from '../policytree'
import { HashMap, serialize, deserialize } from '../hashmap'
import { uploadBuffer, downloadFile } from '../skynet/skynet'
import { Transition, TransitionSet, serializableTransition, transFromSerializeableTransition, SerializableTransition } from '../transitionset'
import { makeBlock, decodeBits } from '../repo/block'

const log = debug('ethereum')

export const provider = new providers.JsonRpcProvider()
export const signer = provider.getSigner()
export const contract = new Contract(PolicyTreeTransitionContract.networks['33343733366'].address, PolicyTreeTransitionContract.abi, signer)

interface EthereumUniverse {
    getBlock: typeof provider.getBlock,
    utils: {
        id: typeof utils.id,
    },
    getLogs: typeof provider.getLogs,
    getAsset: (did:string)=>Promise<ReadOnlyTree>,
}

export class EthereumBack {
    repo: Repo
    baseUniverse: {eth: EthereumUniverse}

    constructor(repo: Repo) {
        this.repo = repo,
        this.baseUniverse = {
            eth: {
                getBlock: provider.getBlock.bind(provider),
                utils: harden({
                    id: utils.id.bind(utils),
                }),
                getLogs: provider.getLogs.bind(provider),
                getAsset: async (did:string)=> {
                    return (await this.getAsset(did)).readOnly()
                },
            }
        }
    }

    async createAsset(genesis: GenesisOptions): Promise<[string]> {
        const sendingAddress = await signer.getAddress()
        if (!genesis.initialOwners) {
            genesis.initialOwners = [sendingAddress]
        }

        const hshMp = await HashMap.create(this.repo.blocks)
        await hshMp.set('genesis', genesis)

        const serialized = await serialize(hshMp, this.repo.blocks)

        const siaUrl = await uploadBuffer(serialized)
        log("siaUrl: ", siaUrl)

        const bloom = hshMp.cid.multihash.slice(2) // first 2 bytes are codec and length

        const resp = await contract.log(bloom, Buffer.from(siaUrl))
        log("create resp: ", resp)
        return [`did:eth:${resp.blockNumber}-${sendingAddress}-${resp.hash}`]
    }

    async messageAsset(did: string, trans: Transition) {
        throw new Error("unimplemented")
    }

    async transitionAsset(did: string, trans: Transition) {
        const blk = await makeBlock(serializableTransition(trans))
        const bloom = utils.id(did)
        return await contract.log(bloom, blk.data)
    }

    private async getLocal(did: string) {
        const tree = new PolicyTree({did, repo: this.repo, universe: this.baseUniverse})

        if (await tree.exists()) {
            return tree
        }

        return undefined
    }

    private getEventsFor(did:string, height:number) {
        const filter = contract.filters.Transition(null, utils.id(did))
        return contract.queryFilter(filter, height)
    }

    async getAsset(did: string) {
        log("get asset: ", did)
        const idParts = did.split(':')[2] // comes in the format did:eth:${resp.blockNumber}-${sendingAddress}-${resp.transactionHash}
        const [_blockNumberStr,_sendingAddress,transHash] = idParts.split('-')
        const genesisTrans = await provider.getTransactionReceipt(transHash)
        log("genesis tx: ", genesisTrans, " logs: ", genesisTrans.logs)

        log("genesis: ", genesisTrans)
        if (!genesisTrans) {
            throw new Error("Not Found: " + genesisTrans)
        }
        let tree: PolicyTree
        const localTree = await this.getLocal(did)
        if (localTree) {
            log("local tree exists for ", did, " genesis: ", await localTree.getMeta(GENESIS_KEY))
            tree = localTree
        } else {
            const mp = await this.genesisToHashMap(genesisTrans)
            const genesis = await mp.get('genesis')
            log("genesis: ", genesis)

            tree = await PolicyTree.create({repo: this.repo, did, universe: this.baseUniverse}, genesis)
        }

        return this.playTransactions(tree, did, await this.getEventsFor(did, genesisTrans.blockNumber + 1))
    }

    private async eventToTransition(evt: Event):Promise<Transition|null> {
        const bits = Buffer.from(evt.args.transition.slice(2), 'hex')
        // const mpBits = await downloadFile(siaUrl)
        const serializedTrans = await decodeBits<SerializableTransition>(bits)
        return transFromSerializeableTransition(serializedTrans)
    }
    
    private async genesisToHashMap(trans: providers.TransactionReceipt):Promise<HashMap|null> {
        const transition = contract.interface.decodeEventLog("Transition", trans.logs[0].data).transition

        const siaUrl:string = Buffer.from(transition.slice(2), 'hex').toString('utf-8')
        const mpBits = await downloadFile(siaUrl)
        return deserialize(this.repo.blocks, mpBits)
    }
    
    // TODO: this will eventually also support the 32 byte bloom filter for aggregation
    // for now it is only the did
    eventHasDid(did:string, evt:Event) {
        const hsh = utils.id(did)
        return evt.args.bloom === hsh
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

        let highestBlock = 0
        for (const tran of transactions) {
            if (tran.blockNumber > highestBlock) {
                highestBlock = tran.blockNumber
            }
            if (latest && tran.blockNumber <= latest.height ) {
                // if this transaction has already been included, we can skip it
                continue
            }
            if (!this.eventHasDid(did, tran)) {
                continue
            }
            const transition = await this.eventToTransition(tran)
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

        const nextEvents = await this.getEventsFor(did, highestBlock+1)
        return this.playTransactions(tree, did, nextEvents)
    }
}
