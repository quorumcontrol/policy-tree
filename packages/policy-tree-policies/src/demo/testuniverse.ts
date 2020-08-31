import { StandardEndowments } from 'policy-tree'

declare const global: StandardEndowments

const { setData } = global.getTree()

async function run() {
    const transition = global.getTransition()
    const universe = await global.getUniverse()

    if (universe.hello() !== 'world') {
        return false
    }

    switch (transition.type) {
        case -1:
            return true
        case 2:
            for (let key of Object.keys(transition.metadata)) {
                await setData(key, transition.metadata[key])
            }
            return true
        default:
            throw new Error("unknown type: " + transition.type)
    }
}
run()