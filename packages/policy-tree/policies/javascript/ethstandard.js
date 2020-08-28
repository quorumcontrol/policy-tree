const GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2

const { setData } = getTree()

async function run() {
    const transition = await getTransition()
    switch (transition.type) {
        case GENESIS:
            // do nothing on genesis
            return true
        case SET_DATA:
            for (let key of Object.keys(transition.metadata)) {
                await setData(key, transition.metadata[key])
            }
            return true
        default:
            throw new Error("unknown type: " + transition.type)
    }
}
run()