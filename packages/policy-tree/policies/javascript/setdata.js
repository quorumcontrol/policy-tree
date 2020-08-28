async function run() {
    const transition = await getTransition()
    switch (transition.type) {
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