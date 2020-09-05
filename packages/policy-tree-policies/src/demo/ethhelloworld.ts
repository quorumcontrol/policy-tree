import { StandardEndowments, HandlerExport } from 'policy-tree'

enum TransitionTypes {
    GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3,
}

declare const global: StandardEndowments

const exp:HandlerExport = {
    [TransitionTypes.GENESIS]: async ()=> {
        return true
    },
    [1000]: async (tree, transition, {eth})=> {
        tree.setData("transHeight", transition.height)
        tree.setData("block", await eth.getBlock())
        return true
    }
}

module.exports = exp
