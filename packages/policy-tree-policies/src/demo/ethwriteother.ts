import { StandardEndowments, HandlerExport, TransitionTree, Transition } from 'policy-tree'

declare const global: StandardEndowments

enum TransitionTypes {
    GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3,
}

const WRITE_OTHER = 4

const assertOwner = async (tree: TransitionTree, trans: Transition) => {
    const { initialOwners } = await tree.getMeta("/genesis")
    const currentOwners = await tree.getData("/owners")

    const owners = (currentOwners || initialOwners)
    if (!owners.includes(trans.sender)) {
        global.print("invalid sender")
        return false
    }
}

const exp: HandlerExport = {
    [TransitionTypes.GENESIS]: async (_tr, _tra, _u) => {
        return true
    },
    [TransitionTypes.SET_DATA]: async (tree, transition) => {
        if (!(await assertOwner(tree, transition))) {
            return false
        }
        for (let key of Object.keys(transition.metadata)) {
            tree.setData(key, transition.metadata[key])
        }
        return true
    },
    [TransitionTypes.SEND_TOKEN]: async (tree, transition) => {
        if (!(await assertOwner(tree, transition))) {
            return false
        }
        const metadata = transition.metadata
        return tree.sendToken(metadata.token, metadata.dest, new global.BigNumber(metadata.amount), metadata.nonce)
    },
    [TransitionTypes.RECEIVE_TOKEN]: async (tree, transition, universe) => {
        if (!(await assertOwner(tree, transition))) {
            return false
        }
        const metadata = transition.metadata
        const otherTree = await universe.getAsset(metadata.from)
        return tree.receiveToken(metadata.token, metadata.nonce, otherTree)
    },
    [TransitionTypes.MINT_TOKEN]: async (tree, transition) => {
        if (!(await assertOwner(tree, transition))) {
            return false
        }
        const metadata = transition.metadata
        return tree.mintToken(metadata.token, new global.BigNumber(metadata.amount))
    },
    [WRITE_OTHER]: async (tree, transition, {getAsset}) => {
        if (!(await assertOwner(tree, transition))) {
            return false
        }
        const metadata = transition.metadata
        const other = await getAsset(metadata.did)
        return tree.setData(metadata.did, other.getData("hi"))
    },
}

module.exports = exp
