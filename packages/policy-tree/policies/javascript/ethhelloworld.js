async function run() {
    const transition = await getTransition()
    const { eth } = getUniverse()

    switch (transition.type) {
        case -1:
            return true
        case 1000:
            await set("transHeight", transition.height)
            await set("block", await eth.getBlock())
            return true
        default:
            return false
    }
}

run()