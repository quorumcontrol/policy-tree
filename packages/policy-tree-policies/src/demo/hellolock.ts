import { HandlerExport } from 'policy-tree'

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
    [TransitionTypes.SET_DATA]: async (tree, transition) => {
        const metadata = transition.metadata
        // always allow setting the /hello key
        if (metadata['/hello']) {
            return tree.setData('/hello', metadata['/hello'])
        }

        // otherwise make sure '/hello' === 'world'
        const currentHello = await tree.getData('/hello')
        if (currentHello !== 'world') {
            return false
        }

        // but if we're here you've unlocked the asset, yay!
        for (let key of Object.keys(transition.metadata)) {
            tree.setData(key, transition.metadata[key])
        }
        return true
    }
}

module.exports = exp
