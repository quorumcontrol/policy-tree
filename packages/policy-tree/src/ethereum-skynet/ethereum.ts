import { providers, Contract, Event, utils, Signer } from 'ethers'
import PolicyTreeTransitionContract from './PolicyTreeTransitions.json'
import debug from 'debug'
import Repo from '../repo/repo'
import { GenesisOptions, PolicyTree, GENESIS_KEY } from '../policytree/policytree'
import { HashMap, serialize, deserialize } from '../hashmap'
import { uploadBuffer, downloadFile } from '../skynet/skynet'
import { Transition, TransitionSet, serializableTransition, transFromSerializeableTransition, SerializableTransition } from '../transitionset'
import { makeBlock, decodeBits } from '../repo/block'
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

function didFromTxHash(txHash:string) {
    return `did:eth:${Buffer.from(txHash.slice(2), 'hex').toString('base64')}`
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

    async createAsset(genesis: GenesisOptions, customBloom?:string): Promise<[string]> {
        log("createAsst")
        const sendingAddress = await this.signer.getAddress()
        if (!genesis.initialOwners) {
            genesis.initialOwners = [sendingAddress]
        }

        const hshMp = await HashMap.create(this.repo.blocks)
        await hshMp.set('genesis', genesis)

        const serialized = await serialize(hshMp, this.repo.blocks)

        log("serialized size: ", serialized.byteLength)
        const siaUrl = await uploadBuffer(serialized)
        log("siaUrl: ", siaUrl)

        const bloom = customBloom ? utils.id(customBloom) : hshMp.cid.multihash.slice(2) // first 2 bytes are codec and length

        const resp:providers.TransactionResponse = await this.contract.log(bloom, Buffer.from(siaUrl))
        log("create resp: ", resp)
        const receipt = await resp.wait(confirmationsRequired)
        log("create receipt: ", receipt)
        // did is the base64 encoded transaction hash
        return [didFromTxHash(resp.hash)]
    }

    async messageAsset(did: string, trans: Transition) {
        throw new Error("unimplemented")
    }

    async transitionAsset(did: string, trans: Transition) {
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
        const firstLog = evts[0]
        if (!firstLog) {
            return undefined
        }
        const tr = await firstLog.getTransaction()
        return this.getAsset(didFromTxHash(tr.hash))
    }

    async getAsset(did: string, maxBlockHeight?: number) {
        log("get asset: ", did)
        const transHashBase64 = did.split(':')[2] // comes in the format did:eth:${resp.blockNumber}-${resp.transactionHash}
        const transHash = '0x' + Buffer.from(transHashBase64, 'base64').toString('hex')
        const genesisTrans = await this.provider.getTransactionReceipt(transHash)
        log("genesis tx: ", genesisTrans, " logs: ", genesisTrans.logs)
        
        if (!genesisTrans) {
            throw new Error("Not Found: " + genesisTrans)
        }
        let tree: PolicyTree
        const localTree = await this.getLocal(did)
        if (localTree) {
            log("local tree exists for ", did, " genesis: ", await localTree.getMeta(GENESIS_KEY))
            tree = localTree
            const height = (await tree.current()).height
            if (height >= maxBlockHeight) {
                return tree
            }
        } else {
            const mp = await this.genesisToHashMap(genesisTrans)
            const genesis = await mp.get('genesis')
            log("genesis: ", genesis)

            tree = await PolicyTree.create({ repo: this.repo, did }, genesis, this.baseUniverse)
        }

        const height = (await tree.current()).height

        return this.playTransactions(tree, did, await this.getEventsFor(
            did,
            height ? (height + 1) : (genesisTrans.blockNumber + 1),
            maxBlockHeight,
        ), maxBlockHeight)
    }

    private async eventToTransition(evt: Event): Promise<Transition | null> {
        const bits = Buffer.from(evt.args.transition.slice(2), 'hex')
        // const mpBits = await downloadFile(siaUrl)
        const serializedTrans = await decodeBits<SerializableTransition>(bits)
        return transFromSerializeableTransition(serializedTrans)
    }

    private async genesisToHashMap(trans: providers.TransactionReceipt): Promise<HashMap | null> {
        const transition = this.contract.interface.decodeEventLog("Transition", trans.logs[0].data).transition

        const siaUrl: string = Buffer.from(transition.slice(2), 'hex').toString('utf-8')
        const mpBits = await downloadFile(siaUrl)
        return deserialize(this.repo.blocks, mpBits)
    }

    // TODO: this will eventually also support the 32 byte bloom filter for aggregation
    // for now it is only the did
    eventHasDid(did: string, evt: Event) {
        const hsh = utils.id(did)
        return evt.args.bloom === hsh
    }

    private async playTransactions(tree: PolicyTree, did: string, transactions: Event[], maxBlockHeight?: number): Promise<PolicyTree> {
        log("play transactions: ", transactions)
        // if we have no transactions here it means we've reached the end of paging
        if (transactions.length === 0) {
            return tree
        }

        // go through all the transactions and if none of them are more recent, just move onto the next one

        const transitionsByBlockHeight: { [key: number]: Transition[] } = {}

        let highestBlock = 0
        for (const tran of transactions) {
            if (tran.blockNumber > highestBlock) {
                highestBlock = tran.blockNumber
            }
            if (!this.eventHasDid(did, tran)) {
                continue
            }
            const transition = await this.eventToTransition(tran)
            if (!transition) {
                continue
            }
            transition.sender = tran.args.from

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
            const previousBlock = set.height - 1
            await tree.applySet(set, {
                ...this.baseUniverse,
                // we want the transitions to always produce reproducible results so always use the state of *other* assets
                // at the previous block height to the block height of this transition
                getAsset: async (did: string) => {
                    log("this asset called: ", previousBlock)
                    return (await (await this.getAsset(did, previousBlock)).at(previousBlock))
                },
            })
        }

        const nextEvents = await this.getEventsFor(did, highestBlock + 1)
        return this.playTransactions(tree, did, nextEvents, maxBlockHeight)
    }
}
