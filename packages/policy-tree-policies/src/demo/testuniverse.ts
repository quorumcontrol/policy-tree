import { StandardEndowments, HandlerExport } from 'policy-tree'

declare const global: StandardEndowments

enum TransitionTypes {
    GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3,
}

const exp: HandlerExport = {
    [TransitionTypes.GENESIS]: async () => {
        return true
    },
    [TransitionTypes.SET_DATA]: async (tree, transition, universe) => {
        if (universe.hello() !== 'world') {
            return false
        }

        for (let key of Object.keys(transition.metadata)) {
            tree.setData(key, transition.metadata[key])
        }
        return true
    }
}

module.exports = exp
