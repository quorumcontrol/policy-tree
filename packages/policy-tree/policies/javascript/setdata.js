async function run() {
    const transition = await getTransition()
    switch (transition.type) {
        case "setdata":
            await set(transition.metadata.key, transition.metadata.value)
            return true
        default:
            throw new Error("unknown type: " + transition.type)
    }
}
run()