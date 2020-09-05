import {  HandlerExport, TransitionTree, Transition, EthereumUniverse } from 'policy-tree'
import { Filter } from 'policy-tree/node_modules/@ethersproject/providers'

enum TransitionTypes {
    GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3,
    NOTICE_ETH = 4,
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
    [TransitionTypes.NOTICE_ETH]: async (tree, transition, {getLogs, utils}) => {
        const contractAddr = await tree.getMeta("erc20ContractAddress")
        const destinationAddr = await tree.getMeta("destinationAddress")
        const token = canonicalTokenName(tree.did, await tree.getMeta("token"))
        const filter:Filter = {
            address: contractAddr,
            topics: [
                utils.id("TransferSingle(address,address,address,uint256,uint256)"),
                null,
                utils.hexZeroPad(transition.sender, 32),
                utils.hexZeroPad(destinationAddr, 32)
            ],
            fromBlock: transition.metadata.block,
            toBlock: transition.metadata.block,
        }
        // const filter:Filter = {
        //     address: contractAddr,
        //     topics: [
        //         utils.id("Transfer(address,address,uint256)"),
        //         transition.sender,
        //         destinationAddr,
        //     ],
        //     fromBlock: transition.metadata.block,
        //     toBlock: transition.metadata.block,
        // }
        const destinationLogs = await getLogs(filter)
        for (let transfer of destinationLogs) {
            // TODO: send more than 1 token basedon value
            log("transfer: ", transfer)
            tree.sendToken(token, transition.metadata.dest, BigNumber.from(1), transfer.transactionHash)
        }
    }
}

module.exports = exp
