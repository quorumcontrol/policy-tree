import { StandardEndowments } from 'policy-tree'

declare const global: StandardEndowments

const GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3

const { setData, sendToken, receiveToken, mintToken, getData, getMeta } = global.getTree()

async function run() {
    const transition = await global.getTransition()
    const metadata = transition.metadata

    if (transition.type === GENESIS) {
        return true
    }

    const { initialOwners } = await getMeta("/genesis")
    const currentOwners = await getData("/owners")

    const owners = (currentOwners || initialOwners)
    if (!owners.includes(transition.sender)) {
        global.print("invalid sender")
        return false
    }

    const { eth: { getAsset } } = global.getUniverse()

    switch (transition.type) {
        case SET_DATA:
            global.print("set data")
            for (let key of Object.keys(transition.metadata)) {
                await setData(key, transition.metadata[key])
            }
            return true
        case SEND_TOKEN:
            global.print("send")
            return sendToken(metadata.token, metadata.dest, new global.BigNumber(metadata.amount), metadata.nonce)
        case RECEIVE_TOKEN:
            const otherTree = await getAsset(metadata.from)
            return receiveToken(metadata.token, metadata.nonce, otherTree)
        case MINT_TOKEN:
            global.print("mint")
            return mintToken(metadata.token, new global.BigNumber(metadata.amount))
        default:
            throw new Error("unknown type: " + transition.type)
    }
}
run()