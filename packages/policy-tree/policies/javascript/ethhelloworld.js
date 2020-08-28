async function run() {
    const transition = await getTransition()
    const { eth } = getUniverse()
    const { setData } = getTree()

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