import {  HandlerExport, EthereumUniverse,  Transition } from 'policy-tree'
import { Filter } from 'policy-tree/node_modules/@ethersproject/providers'

enum TransitionTypes {
    GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3,
    NOTICE_ELEVATION = 4,
    DESCEND = 5,
    NOTICE_DESCENT = 6,
}

interface DescendMeta {
    from: string // did of sender
    nonce: string // nonce of the sendToken
    to: string // eth addr to send HWEI
}

interface OfferStore extends DescendMeta {
    createdAt: number // blockNumber
}

interface NoticeDescentMeta {
    block: number // block number
    offer: string // the stored hash of the offer
    pay: string // did of provider
}


// const assertOwner = async (tree: TransitionTree, trans: Transition) => {
//     const { initialOwners } = await tree.getMeta("/genesis")
//     const currentOwners = await tree.getData("/owners")

//     const owners = (currentOwners || initialOwners)
//     if (!owners.includes(trans.sender)) {
//         log("invalid sender")
//         return false
//     }
//     return true
// }

function canonicalTokenName(did: string, tokenName: string) {
    return `${did}-${tokenName}`
}

const exp: HandlerExport<EthereumUniverse> = {
    [TransitionTypes.GENESIS]: async (tree, _tra, _u) => {
        const token = await tree.getMeta("token")
        // TODO: set mint from meta
        tree.mintToken(token, BigNumber.from(1000))
        return true
    },
    // [TransitionTypes.SET_DATA]: async (tree, transition) => {
    //     if (!(await assertOwner(tree, transition))) {
    //         return false
    //     }
    //     for (let key of Object.keys(transition.metadata)) {
    //         tree.setData(key, transition.metadata[key])
    //     }
    //     return true
    // },
    // [TransitionTypes.SEND_TOKEN]: async (tree, transition) => {
    //     if (!(await assertOwner(tree, transition))) {
    //         return false
    //     }
    //     const metadata = transition.metadata
    //     return tree.sendToken(metadata.token, metadata.dest, BigNumber.from(metadata.amount), metadata.nonce)
    // },
    // [TransitionTypes.RECEIVE_TOKEN]: async (tree, transition, {getAsset}) => {
    //     if (!(await assertOwner(tree, transition))) {
    //         return false
    //     }
    //     const metadata = transition.metadata
    //     const otherTree = await getAsset(metadata.from)
    //     return tree.receiveToken(metadata.token, metadata.nonce, otherTree)
    // },
    // [TransitionTypes.MINT_TOKEN]: async (tree, transition) => {
    //     if (!(await assertOwner(tree, transition))) {
    //         return false
    //     }
    //     const metadata = transition.metadata
    //     return tree.mintToken(metadata.token, BigNumber.from(metadata.amount))
    // },
    [TransitionTypes.NOTICE_ELEVATION]: async (tree, transition, {getLogs, utils}) => {
        const contractAddr = await tree.getMeta("contractAddress")
        const token = canonicalTokenName(tree.did, "hwei")
        const filter:Filter = {
            address: contractAddr,
            topics: [
                utils.id("Elevate(bytes32,address,uint256)"),
                utils.id(transition.metadata.dest)
            ],
            fromBlock: transition.metadata.block,
            toBlock: transition.metadata.block,
        }
        const destinationLogs = await getLogs(filter)
        for (let elevation of destinationLogs) {
            // TODO: send more than 1 token basedon value
            log("elevation: ", elevation)
            const p = await tree.getPayment(token, elevation.transactionHash)
            if (p) {
                continue
            }
            const amount = utils.decodeAbi(["address","uint256"], elevation.data)[1]
            log("minting: ", token, amount, ' nonce: ', elevation.transactionHash)
            tree.mintToken("hwei", amount)
            tree.sendToken(token, transition.metadata.dest, amount, elevation.transactionHash)
        }
    },
    [TransitionTypes.DESCEND]: async (tree, transition, {utils, getAsset})=> {
        const meta:DescendMeta = (transition.metadata as any)
        const id = utils.id(meta.from + meta.nonce)
        const offerKey = `offers/${id}`
        const existing = tree.getData(offerKey)
        if (existing) {
            return false
            // only allow one descend
        }

        const token = canonicalTokenName(tree.did, "hwei")
        const otherTree = await getAsset(meta.from)
        const payment = otherTree.getPayment(token, meta.nonce)
        if (!payment) {
            return false
        }
        if (!tree.receiveToken(token, meta.nonce, otherTree)) {
            return false
        }
        tree.setData(offerKey, {
            ...meta,
            createdAt: transition.height,
            amount: payment.amount,
        } as OfferStore)
    },
    [TransitionTypes.NOTICE_DESCENT]: async (tree, transition, {utils, getLogs})=> {
        log("NOTICE_DESCENT")
        const contractAddr = await tree.getMeta("contractAddress")
        const token = canonicalTokenName(tree.did, "hwei")
        const meta:NoticeDescentMeta = transition.metadata as any

        const offerKey = `offers/${meta.offer}`
        const existing = tree.getData(offerKey)
        if (!existing) {
            return false // offer doesn't exist
        }
        if (existing === true) {
            return false // already fulfilled
        }

        const filter:Filter = {
            address: contractAddr,
            topics: [
                // event OfferHandled(bytes32 indexed offer, uint256 indexed amount, address to, bytes32 didHash);
                utils.id('OfferHandled(bytes32,uint256,address,bytes32)'),
                meta.offer,
                utils.hexZeroPad(BigNumber.from(existing.amount).toHexString(), 32),
            ],
            fromBlock: transition.metadata.block,
            toBlock: transition.metadata.block,
        }
        const offerLogs = await getLogs(filter)
        log("offerLogs: ", offerLogs)
        const metaHsh = utils.id(meta.pay)
        for (let offerHandledEvent of offerLogs) {
            // TODO: send more than 1 token basedon value
            log("offerHandled: ", offerHandledEvent)
            const didHash = utils.decodeAbi(["address","bytes32"], offerHandledEvent.data)[1]
            if (didHash === metaHsh) {
                log("paying: ", meta.pay)
                if (!tree.sendToken(token, meta.pay, BigNumber.from(existing.amount), meta.offer)) {
                    return false
                }
                tree.setData(offerKey, true)
            }
        }
    }
}

module.exports = exp
