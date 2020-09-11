import { providers, Contract, Event, utils, Signer } from 'ethers'
import PolicyTreeTransitionContract from './PolicyTreeTransitions.json'
import debug from 'debug'
import Repo from '../repo/repo'
import { GenesisOptions, PolicyTree, GENESIS_KEY } from '../policytree/policytree'
// import { HashMap, serialize, deserialize } from '../hashmap'
// import { uploadBuffer, downloadFile } from '../skynet/skynet'
import { Transition, TransitionSet, serializableTransition, transFromSerializeableTransition, SerializableTransition } from '../transitionset'
import { makeBlock, decodeBits, blockFromBits } from '../repo/block'
import { ReadOnlyPolicyTreeVersion } from '../policytree'


const log = debug('ethereum')

const confirmationsRequired = 1

export const IDENTITY_BLOOM = 'identity'

export interface EthereumUniverse {
    getBlock: providers.Provider['getBlock']
    utils: {
        id: typeof utils.id
        hexZeroPad: typeof utils.hexZeroPad
        decodeAbi: utils.AbiCoder['decode']
    },
    getLogs: providers.Provider['getLogs']
    getAsset: (did: string) => Promise<ReadOnlyPolicyTreeVersion>
}

interface EthereumBackOpts {
    repo: Repo
    provider: providers.Provider
    signer: Signer
    contractAddress: string
}

interface maxHeightOpts {
    block:number // the block number
    index?:number // the transaction index in the block
}

function didFromTxHash(txHash:string) {
    return `did:eth:${utils.base58.encode(Buffer.from(txHash.slice(2), 'hex'))}`
}

// TODO: maybe something like this which lets you decide where
// to store the transaction
// interface CreateAssetOpts {
//     customBloom?: string
//     useSia?: boolean
// }

const BLOCK_NUMBER_MULTIPLIER = 1000000000000
const TRANSACTION_INDEX_MULTIPLIER = 100000
/**
 * evtToHeight takes a combination of blockHeight, transaction index (within the block) and log index (index within the transaction)
 * to produce a global 'height' of a single transition. We are assuming a maximum of approximately 10,000,000 txs per block and 100,000 logs per transaction
 * @param evt 
 */
function evtToHeight(evt:Event):number {
    return partsToHeight(evt.blockNumber, evt.transactionIndex, evt.logIndex)
}

function partsToHeight(blockNumber:number, transactionIndex:number, logIndex:number) {
    return (blockNumber * BLOCK_NUMBER_MULTIPLIER) + (transactionIndex * TRANSACTION_INDEX_MULTIPLIER) + logIndex
}

function heightToBlockHeight(height:number) {
    return Math.trunc(height / BLOCK_NUMBER_MULTIPLIER)
}

function heightToTransactionIndex(height:number) {
    // first we subtract the block height
    const transactionIndexAndLogIndex = height - (heightToBlockHeight(height) * BLOCK_NUMBER_MULTIPLIER)
    // then we return the transaction index without the log index
    return Math.trunc(transactionIndexAndLogIndex / TRANSACTION_INDEX_MULTIPLIER)
}

// take the big number, and get the previous log index, which could be in the previous transaction
const MAX_TRAN = 100000000000
const MAX_LOG = 10000
function previousLogIndex(height:number) {
    const block = heightToBlockHeight(height)
    const txIndex = heightToTransactionIndex(height)
    const logIndex = height - (block * BLOCK_NUMBER_MULTIPLIER) - (txIndex * TRANSACTION_INDEX_MULTIPLIER)
    if (logIndex > 0) {
        return partsToHeight(block, txIndex, logIndex - 1)
    }
    if (txIndex > 0) {
        return partsToHeight(block, txIndex - 1, MAX_LOG)
    }
    return partsToHeight(block-1, MAX_TRAN, MAX_LOG)
}   



export class EthereumBack {
    repo: Repo
    baseUniverse: EthereumUniverse
    contract: Contract
    provider: providers.Provider
    signer: Signer

    constructor({repo, provider, signer, contractAddress}:EthereumBackOpts) {
        this.repo = repo
        this.baseUniverse = {
            getBlock: provider.getBlock.bind(provider),
            utils: harden({
                id: utils.id.bind(utils),
                hexZeroPad: utils.hexZeroPad.bind(utils),
                decodeAbi: utils.defaultAbiCoder.decode.bind(utils.defaultAbiCoder),
            }),
            getLogs: provider.getLogs.bind(provider),
            getAsset: async (did: string) => {
                return (await (await this.getAsset(did)).current()).readOnly()
            },
        }
        this.provider = provider
        this.signer = signer
        this.contract = new Contract(contractAddress, PolicyTreeTransitionContract.abi, signer)
    }

    async createAsset(genesis: GenesisOptions, customBloom?:string): Promise<[string, providers.TransactionReceipt, providers.TransactionResponse]> {
        log("createAsst")
        const sendingAddress = await this.signer.getAddress()
        if (!genesis.initialOwners) {
            genesis.initialOwners = [sendingAddress]
        }

        // const hshMp = await HashMap.create(this.repo.blocks)
        // await hshMp.set('genesis', genesis)

        // const serialized = await serialize(hshMp, this.repo.blocks)

        // log("serialized size: ", serialized.byteLength)
        // const siaUrl = await uploadBuffer(serialized)
        // log("siaUrl: ", siaUrl)

        const genesisBlock = await makeBlock(genesis)

        const bloom = customBloom ? utils.id(customBloom) : genesisBlock.cid.multihash.slice(2) // first 2 bytes are codec and length
        // const bloom = customBloom ? utils.id(customBloom) : hshMp.cid.multihash.slice(2) // first 2 bytes are codec and length

        log("logging to ethereum: ", bloom, genesis)
        const resp:providers.TransactionResponse = await this.contract.log(bloom, genesisBlock.data)
        log("create resp: ", resp)
        const receipt = await resp.wait(confirmationsRequired)
        log("create receipt: ", receipt)
        // did is the base64 encoded transaction hash
        return [didFromTxHash(resp.hash), receipt, resp]
    }

    async messageAsset(_did: string, _trans: Transition) {
        throw new Error("unimplemented")
    }

    async transitionAsset(did: string, trans: Transition):Promise<providers.TransactionResponse> {
        const blk = await makeBlock(serializableTransition(trans))
        const bloom = utils.id(did)
        return await this.contract.log(bloom, blk.data)
    }

    private async getLocal(did: string) {
        const tree = new PolicyTree({ did, repo: this.repo })

        if (await tree.exists()) {
            return tree
        }

        return undefined
    }

    private getEventsFor(did: string, height: number, max?: number) {
        const filter = this.contract.filters.Transition(null, utils.id(did))
        return this.contract.queryFilter(filter, height, max)
    }
    
    async getIdentity(addr:string) {
        const filter = this.contract.filters.Transition(addr, utils.id(IDENTITY_BLOOM))
        const evts = await this.contract.queryFilter(filter)
        const lastLog = evts[evts.length-1]
        if (!lastLog) {
            return undefined
        }
        const tr = await lastLog.getTransaction()
        return this.getAsset(didFromTxHash(tr.hash))
    }

    // this should optionally take URLs, sia urls, etc
    async getPolicy(did: string, height: number) {
        log('fetchPolicy: ', did, ' height: ', height)
        const policyTree = await this.getAsset(did, height)
        const policyBits = await policyTree.getMeta<Buffer>('policy')
        log('policy fetched: ', policyBits.toString('utf8'))
        return blockFromBits(policyBits)
    }

    async getAsset(did: string, maxHeight?: number) {
        log("get asset: ", did)
        const transHashBase58 = did.split(':')[2] // comes in the format did:eth:${resp.blockNumber}-${resp.transactionHash}
        const transHash = utils.hexlify(utils.base58.decode(transHashBase58))
        const genesisTrans = await this.provider.getTransactionReceipt(transHash)
        log("genesis tx: ", genesisTrans, " logs: ", genesisTrans.logs)
        
        if (!genesisTrans) {
            throw new Error("Not Found: " + genesisTrans)
        }
        let tree: PolicyTree
        const localTree = await this.getLocal(did)
        if (localTree) {
            log("local tree exists for ", did, " genesis: ", await localTree.getMeta(GENESIS_KEY), " height: ", await localTree.height())
            tree = localTree
            const height = await tree.height()
            if (height >= maxHeight) {
                return tree
            }
        } else {
            const genesis = await this.receiptToGenesis(genesisTrans)
            if (genesis.policy && !(await this.repo.blocks.has(genesis.policy))) {
                const policyBlock = await this.getPolicy(genesis.policyLocator, genesisTrans.blockNumber)
                await this.repo.blocks.put(policyBlock)
            }
            // const genesis = await mp.get('genesis')
            log("genesis: ", genesis)

            tree = await PolicyTree.create({ repo: this.repo, did }, genesis, this.baseUniverse)
        }

        const height = (await tree.current()).height

        const blockHeight = height ? heightToBlockHeight(height) : genesisTrans.blockNumber

        return this.playTransactions(
            tree, 
            did, 
            await this.getEventsFor(did, blockHeight, (maxHeight ? heightToBlockHeight(maxHeight) : undefined)),
            maxHeight,
        )
    }

    private async eventToTransition(evt: Event): Promise<Transition | null> {
        const bits = Buffer.from(evt.args.transition.slice(2), 'hex')
        // const mpBits = await downloadFile(siaUrl)
        const serializedTrans = await decodeBits<SerializableTransition>(bits)
        return transFromSerializeableTransition(serializedTrans)
    }

    // private async genesisToHashMap(trans: providers.TransactionReceipt): Promise<HashMap | null> {
    //     const transition = this.contract.interface.decodeEventLog("Transition", trans.logs[0].data).transition

    //     const siaUrl: string = Buffer.from(transition.slice(2), 'hex').toString('utf-8')
    //     const mpBits = await downloadFile(siaUrl)
    //     return deserialize(this.repo.blocks, mpBits)
    // }

    private async receiptToGenesis(trans: providers.TransactionReceipt): Promise<GenesisOptions | null> {
        const transition = this.contract.interface.decodeEventLog("Transition", trans.logs[0].data).transition
        const genesisBits = Buffer.from(transition.slice(2), 'hex')
        return decodeBits(genesisBits)
    }

    // TODO: this will eventually also support the 32 byte bloom filter for aggregation
    // for now it is only the did
    eventHasDid(did: string, evt: Event) {
        const hsh = utils.id(did)
        return evt.args.bloom === hsh
    }

    private async playTransactions(tree: PolicyTree, did: string, events: Event[], maxHeight?: number): Promise<PolicyTree> {
        log("play transactions: ", did, events, "height: ", await tree.height(), "max: ", maxHeight)
        // if we have no transactions here it means we've reached the end of paging
        if (events.length === 0) {
            log("returning tree")
            return tree
        }

        // go through all the transactions and if none of them are more recent, just move onto the next one

        // const transitionsByBlockHeight: { [key: number]: Transition[] } = {}

        let sortedEvents = events.sort((a,b)=> {return evtToHeight(a) - evtToHeight(b)})

        const highestBlock = sortedEvents[sortedEvents.length - 1].blockNumber

        // now find the end of the events we care about
        const indexOfLast = sortedEvents.findIndex((evt)=> {
            return evtToHeight(evt) > maxHeight
        })
        if (indexOfLast !== -1) {
            sortedEvents = sortedEvents.slice(0, indexOfLast)
        }

        const treeHeight = await tree.height()
        let transitionsToApply:Transition[] = []
        for (const event of sortedEvents) {
            const height = evtToHeight(event)
            if (height <= treeHeight) {
                continue // we could be replaying a block we didn't finish
            }
            if (!this.eventHasDid(did, event)) {
                continue // we could have an event that doesn't include this did
            }
            const transition = await this.eventToTransition(event)
            if (!transition) {
                continue
            }
            transition.sender = event.args.from
            transition.height = height
            transitionsToApply.push(transition)
        }

        // const sortedKeys = Object.keys(transitionsByBlockHeight).sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10)).map((k) => parseInt(k, 10))

        const sets = transitionsToApply.map((transition: Transition) => {
            return new TransitionSet({
                source: "eth",
                height: transition.height,
                transitions: [transition],
            })
        })

        for (let set of sets) {
            log("applying set ", set)
            // const previousBlock = set.height
            const previousHeight = previousLogIndex(set.height)
            await tree.applySet(set, {
                ...this.baseUniverse,
                // we want the transitions to always produce reproducible results so always use the state of *other* assets
                // at the previous block height to the block height of this transition
                getAsset: async (did: string) => {
                    log("getAsset called from set: ", did, ' height: ', previousHeight)
                    return (await (await this.getAsset(did, previousHeight)).at(previousHeight))
                },
            })
        }

        const nextEvents = await this.getEventsFor(did, highestBlock + 1)
        return this.playTransactions(tree, did, nextEvents, maxHeight)
    }
}
