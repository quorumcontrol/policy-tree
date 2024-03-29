import StellarSdk, { Operation, Server, TransactionBuilder, ServerApi, Horizon, Asset, Memo, xdr } from 'stellar-sdk'
import { GenesisOptions, PolicyTree, GENESIS_KEY } from '../policytree';
import Repo, { Key } from '../repo/repo';
import CID from 'cids';
import { Transition, TransitionSet } from '../transitionset';
import debug from 'debug';
import { uploadBuffer, downloadFile } from '../skynet/skynet';
import { HashMap, serialize, deserialize } from '../hashmap';

const log = debug('stellar')

export const server = new Server('https://horizon-testnet.stellar.org');
const feePromise = server.fetchBaseFee();

function siaUrlToBuf(url: string) {
    return Buffer.from(url, 'utf-8')
}

// function bufToSiaUrl(buf: Buffer) {
//     return buf.toString('utf-8')
// }

interface KeySet {
    publicKey:string
    privateKey:string
}

export class StellarBack {
    repo: Repo
    privateKey:string
    publicKey:string

    constructor(repo: Repo, keys:KeySet) {
        this.repo = repo
        this.privateKey = keys.privateKey
        this.publicKey = keys.publicKey
    }

    async createAsset(genesis: GenesisOptions): Promise<[string, Horizon.SubmitTransactionResponse]> {
        const account = await server.loadAccount(this.publicKey);
        const fee = await feePromise

        const hshMp = await HashMap.create(this.repo.blocks)
        await hshMp.set('genesis', genesis)

        const siaUrl = await uploadBuffer(await serialize(hshMp, this.repo.blocks))
        log("siaUrl: ", siaUrl)

        const transaction = new TransactionBuilder(account, { fee: fee.toString(10), networkPassphrase: StellarSdk.Networks.TESTNET })
            .addOperation(
                Operation.manageData({ name: "tupelo", value: siaUrlToBuf(siaUrl) })
            )
            .setTimeout(30)
            .build();

        // sign the transaction
        transaction.sign(StellarSdk.Keypair.fromSecret(this.privateKey));

        try {
            const trans = await server.submitTransaction(transaction);
            const did = `did:stellar:${trans.hash}`
            return [did, trans]
        } catch (err) {
            console.error(err);
            throw (err)
        }
    }

    /**
     * messageAsset is a two step process. First, create a transaction with the transition you want
     * and then send a transaction to the assets message queue account with a data item of the transition.
     * @param did 
     * @param trans 
     */
    async messageAsset(did: string, trans: Transition) {
        const tree = await this.getAsset(did)
        const messageQueueAccount = (await tree.getMeta(GENESIS_KEY)).metadata.messageAccount
        if (!messageQueueAccount) {
            throw new Error("asset must allow messaging")
        }

        let account = await server.loadAccount(this.publicKey);
        const fee = await feePromise

        // first we create a transition to the asset in our *own* account
        const resp = await this.transitionAsset(did, trans)

        // then we send the tiniest amount of XLM we can to the message account
        // TODO: the asset should define minimum amounts
        // and in the memo field we point at the transition we made above.
        // redo this fetch for the sequence
        account.incrementSequenceNumber()

        log("building messaging transaction: ")
        const transaction = new TransactionBuilder(account, { fee: fee.toString(10), networkPassphrase: StellarSdk.Networks.TESTNET })
            .addOperation(
                Operation.payment({
                    destination: messageQueueAccount,
                    amount: "1",
                    asset: Asset.native(),
                })
            ).addMemo(Memo.hash(resp?.hash))
            .setTimeout(30)
            .build();

        // sign the transaction
        transaction.sign(StellarSdk.Keypair.fromSecret(this.privateKey));
        log("submitting transaction: ", transaction)
        return server.submitTransaction(transaction)
    }

    async transitionAsset(did: string, trans: Transition) {
        const account = await server.loadAccount(this.publicKey);
        const fee = await feePromise

        log("transitioning asset: ", did, trans)
        const hshMp = await HashMap.create(this.repo.blocks)
        await hshMp.set(did, trans)

        const buf = await serialize(hshMp, this.repo.blocks)
        const siaUrl = await uploadBuffer(buf)
        log("uploaded serialized hashmap: ", siaUrl)
        const transaction = new TransactionBuilder(account, { fee: fee.toString(10), networkPassphrase: StellarSdk.Networks.TESTNET })
            .addOperation(
                Operation.manageData({ name: "tupelo", value: siaUrlToBuf(siaUrl) })
            )
            .setTimeout(30)
            .build();

        // sign the transaction
        transaction.sign(StellarSdk.Keypair.fromSecret(this.privateKey));

        try {
            const transactionResponse = await server.submitTransaction(transaction);
            log('transition: ', trans, ' transaction: ', transactionResponse)
            return transactionResponse
        } catch (err) {
            console.error(err);
            throw new Error(err)
        }
    }

    private async getLocal(did: string) {
        const tree = new PolicyTree({did, repo: this.repo})

        if (await tree.exists()) {
            return tree
        }

        return undefined
    }

    async getAsset(did: string) {
        log("get asset: ", did)
        const hsh = did.split(':')[2] // comes in the format did:stellar:${trans-id}
        const genesisTrans = await server.transactions().transaction(hsh).call()

        let tree: PolicyTree
        const localTree = await this.getLocal(did)
        if (localTree) {
            tree = localTree
        } else {
            const mp = await this.transactionToHashMap(genesisTrans)
            const genesis = await mp.get('genesis')
            tree = await PolicyTree.create({repo: this.repo, did}, genesis)
        }

        // const pagingToken = latest ? latest.metadata['pagingToken'] : genesisTrans.paging_token

        const transactions = await server.transactions().forAccount(genesisTrans.source_account).includeFailed(false).limit(100).cursor(genesisTrans.paging_token).call()
        return this.playTransactions(tree, did, transactions)
    }

    private async transactionToHashMap(trans: ServerApi.TransactionRecord):Promise<HashMap|null> {
        const envelope = xdr.TransactionEnvelope.fromXDR(trans.envelope_xdr, 'base64')

        const operations = envelope.v1().tx().operations()

        for (const op of operations) {
            switch(op.body().switch().name) {
                case 'manageDatum':
                    {
                        const operation = op.body().manageDataOp()
                        if (Buffer.from(operation.dataName()).toString() === 'tupelo') {
                            // don't know why but the type says val is a buffer, but it's actually coming back a a string
                            const siaUrl = operation.dataValue().toString('utf-8')
                            const mpBits = await downloadFile(siaUrl)
                            return deserialize(this.repo.blocks, mpBits)
                        }
                    }
                    break;
                case 'payment':
                    {
                        if (trans.memo_type === 'hash') {
                            log("payment operation from: ", trans.source_account, ' following from transaction: ', trans)
                            const transPointedTo = await server.transactions().transaction(Buffer.from(trans.memo!, 'base64').toString('hex')).call()
                            return this.transactionToHashMap(transPointedTo)
                        }
                    }
                    break;
                default:
                    console.error("unknown operation type: ", op.body().switch().name)
            }
        }

        return null
    }

    private async playTransactions(tree: PolicyTree, did: string, transactions: ServerApi.CollectionPage<ServerApi.TransactionRecord>): Promise<PolicyTree> {
        log("play transactions: ", transactions)
        // if we have no transactions here it means we've reached the end of paging
        if (transactions.records.length === 0) {
            return tree
        }
        // get the latest and if the latest exists than make sure these transactions are greater 
        const latest = (await tree.current()).height

        // go through all the transactions and if none of them are more recent, just move onto the next one

        const transitionsByBlockHeight: { [key: number]: Transition[] } = {}

        for (const tran of transactions.records) {
            if (latest && tran.ledger_attr <= latest ) {
                // if this transaction has already been included, we can skip it
                continue
            }
            const mp = await this.transactionToHashMap(tran)
            const transition = await mp.get(did)
            transition.sender = tran.source_account

            let existing = transitionsByBlockHeight[tran.ledger_attr]
            existing = existing || []
            existing.push(transition)
            transitionsByBlockHeight[tran.ledger_attr] = existing
        }

        const sortedKeys = Object.keys(transitionsByBlockHeight).sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10)).map((k) => parseInt(k, 10))

        const sets = sortedKeys.map((key: number) => {
            return new TransitionSet({
                source: "stellar",
                height: key,
                transitions: transitionsByBlockHeight[key],
            })
        })

        for (let set of sets) {
            log("applying set")
            await tree.applySet(set)
        }

        return this.playTransactions(tree, did, (await transactions.next()))
    }
}
