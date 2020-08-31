import { StandardEndowments } from 'policy-tree'

declare const global: StandardEndowments

async function run() {
    const transition = global.getTransition()
    const { eth } = global.getUniverse()
    const { setData } = global.getTree()

    switch (transition.type) {
        case -1:
            return true
        case 1000:
            await setData("transHeight", transition.height)
            await setData("block", await eth.getBlock())
            return true
        default:
            return false
    }
}

run()