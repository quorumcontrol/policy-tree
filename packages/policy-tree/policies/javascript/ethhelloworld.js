async function run() {
    const transition = getTransition()
    const { eth } = getUniverse()

    await set("transHeight", transition.height)
    await set("block", await eth.getBlock())
}

run()