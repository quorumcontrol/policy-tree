async function run() {
    const transition = getTransition()
    const { eth } = getUniverse()

    switch (transition.type) {
        case "hello":
            const key = `/hello/${transition.sender}`
                // make sure they've never done this
            const exists = await get(key)
            if (exists) {
                return false
            }
            await set(key, true)
            await set(`/balances/${transition.sender}`, 1000)
            break
        default:
            // do nthing
    }
}

run()