const GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3,
    WRITE_OTHER = 4

const { setData, sendToken, receiveToken, mintToken, getData, getMeta } = getTree()

async function run() {
    const transition = await getTransition()
    const metadata = transition.metadata

    if (transition.type === GENESIS) {
        return true
    }

    const { initialOwners } = await getMeta("/genesis")
    const currentOwners = await getData("/owners")

    const owners = (currentOwners || initialOwners)
    if (owners.includes(transition.sender)) {
        print("invalid sender")
        return false
    }

    const { eth: { getAsset } } = getUniverse()

    switch (transition.type) {
        case SET_DATA:
            for (let key of Object.keys(transition.metadata)) {
                await setData(key, transition.metadata[key])
            }
            return true
        case SEND_TOKEN:
            print("send")
            return sendToken(metadata.token, metadata.dest, new BigNumber(metadata.amount), metadata.nonce)
        case RECEIVE_TOKEN:
            const otherTree = await getAsset(metadata.from)
            return receiveToken(metadata.token, metadata.nonce, otherTree)
        case MINT_TOKEN:
            print("mint")
            return mintToken(metadata.token, new BigNumber(metadata.amount))
        case WRITE_OTHER:
            const other = await getAsset(metadata.did)
            return setData(metadata.did, other.getData("hi"))
        default:
            throw new Error("unknown type: " + transition.type)
    }
}
run()