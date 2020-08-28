async function run() {
    const transition = await getTransition()
    const universe = await getUniverse()

    if (universe.hello() !== 'world') {
        return false
    }

    switch (transition.type) {
        case -1:
            return true
        case 2:
            for (let key of Object.keys(transition.metadata)) {
                await set(key, transition.metadata[key])
            }
            return true
        default:
            throw new Error("unknown type: " + transition.type)
    }
}
run()