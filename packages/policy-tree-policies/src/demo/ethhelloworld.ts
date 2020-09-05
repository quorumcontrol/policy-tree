import { HandlerExport, EthereumUniverse } from 'policy-tree'

enum TransitionTypes {
    GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3,
}

const exp:HandlerExport<EthereumUniverse> = {
    [TransitionTypes.GENESIS]: async ()=> {
        return true
    },
    [1000]: async (tree, transition, {getBlock})=> {
        tree.setData("transHeight", transition.height)
        tree.setData("block", await getBlock(transition.height))
        return true
    }
}

module.exports = exp
