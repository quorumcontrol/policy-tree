import StellarSdk, { Operation, Server, TransactionBuilder, ServerApi } from 'stellar-sdk'
import { GenesisOptions, PolicyTree } from '../policytree';
import { makeBlock, decodeBlock } from '../repo/block';
import Repo, { Key } from '../repo/datastore';
import CID from 'cids';
import { Transition, TransitionSet } from '../transitionset';
import debug from 'debug';

const log = debug('stellar')

const publicKey = 'GBE3HUH4YAWYOUU4NISEIRAUVTXCUZUBMD6FPDSOHDWGGJEJJBH22TMD'
const priKey = 'SBZGFEQ2HN7TLPZTD4QJLVPBYF64R532UYDF2TYX5U74QT6GI2Z6ULQM'

export const server = new Server('https://horizon-testnet.stellar.org');
const feePromise = server.fetchBaseFee();

export class StellarBack {
    repo: Repo

    constructor(repo: Repo) {
        this.repo = repo
    }

    async createAsset(genesis:GenesisOptions) {
        const account = await server.loadAccount(publicKey);
        const fee = await feePromise

        const blk = await makeBlock(genesis)
        await this.repo.blocks.put(blk)

        const treeP = PolicyTree.create(this.repo.blocks, genesis)

        const transaction = new TransactionBuilder(account, { fee: fee.toString(10), networkPassphrase: StellarSdk.Networks.TESTNET })
            .addOperation(
                Operation.manageData({ name: "tupelo", value: Buffer.from(blk.cid.buffer) })
            )
            .setTimeout(30)
            .build();

        // sign the transaction
        transaction.sign(StellarSdk.Keypair.fromSecret(priKey));

        try {
            const trans = await server.submitTransaction(transaction);
            const did = `did:stellar:${trans.hash}`
            const tree = await treeP
            await this.repo.datastore.put(new Key(did), (await tree.tip()).buffer)
            return did
        } catch (err) {
            console.error(err);
        }
    }

    async transitionAsset(trans: Transition) {
        const account = await server.loadAccount(publicKey);
        const fee = await feePromise

        const transBlock = await makeBlock(trans)
        await this.repo.blocks.put(transBlock)

        const transaction = new TransactionBuilder(account, { fee: fee.toString(10), networkPassphrase: StellarSdk.Networks.TESTNET })
            .addOperation(
                Operation.manageData({ name: "tupelo", value: Buffer.from(transBlock.cid.buffer) })
            )
            .setTimeout(30)
            .build();

        // sign the transaction
        transaction.sign(StellarSdk.Keypair.fromSecret(priKey));

        try {
            const transactionResponse = await server.submitTransaction(transaction);
            log('transition: ', trans, ' transaction: ', transactionResponse)
            return true
        } catch (err) {
            console.error(err);
        }
    }

    async getAsset(did: string) {
        const hsh = did.split(':')[2] // comes in the format did:stellar:${trans-id}
        const genesisTrans = await server.transactions().transaction(hsh).call()
        const cid = await this.transactionToCid(genesisTrans)

        let tree:PolicyTree
        const existingBits = await this.repo.datastore.get(new Key(did))
        if (existingBits) {
            tree = new PolicyTree(this.repo.blocks, new CID(Buffer.from(existingBits)))
        } else {
            const genesisBlock = await this.repo.blocks.get(cid)
            const val = await decodeBlock(genesisBlock)
            tree = new PolicyTree(this.repo.blocks, val)
        }

        const latest = await tree.lastTransitionSet()
        
        const pagingToken = latest ? latest.metadata['pagingToken'] : genesisTrans.paging_token

        const transactions = await server.transactions().forAccount('GBE3HUH4YAWYOUU4NISEIRAUVTXCUZUBMD6FPDSOHDWGGJEJJBH22TMD').includeFailed(false).cursor(pagingToken).call()
        return this.playTransactions(tree, did, transactions)
    }

    private async transactionToCid(trans: ServerApi.TransactionRecord) {
        const operations = await trans.operations()
        const rec = (operations.records[0] as ServerApi.ManageDataOperationRecord)
        // don't know why but the type says val is a buffer, but it's actually coming back a a string
        const val = Buffer.from(((rec.value as unknown) as string), 'base64')
        const cid = new CID(val)
        return cid
    }

    private async playTransactions(tree: PolicyTree, did: string, transactions: ServerApi.CollectionPage<ServerApi.TransactionRecord>): Promise<PolicyTree> {
        const trans:Transition[] = []
        
        for (const tran of transactions.records) {
            const cid = await this.transactionToCid(tran)
            const blk = await this.repo.blocks.get(cid)
            trans.push(await decodeBlock<Transition>(blk))
        }

        if (trans.length === 0) {
            return tree
        }

        const lastTransaction = transactions.records[transactions.records.length-1]
        const highestBlock = lastTransaction.ledger_attr
        const pagingToken = lastTransaction.paging_token

        const set = new TransitionSet({
            source: "stellar", 
            height: highestBlock, 
            transitions: trans,
            metadata: {
                pagingToken: pagingToken,
            }
        })
        await tree.applySet(set)

        if (transactions.records.length > 0) {
            return this.playTransactions(tree, did, (await transactions.next()))
        }

        await this.repo.datastore.put(new Key(did), (await tree.tip()).buffer)

        return tree
    }

}