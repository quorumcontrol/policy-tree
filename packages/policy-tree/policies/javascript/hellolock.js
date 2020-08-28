async function run() {
    const transition = await getTransition()
    if (transition.type !== 2) {
        return false
    }
    const metadata = transition.metadata

    // always allow setting the /hello key
    if (metadata['/hello']) {
        return set('/hello', metadata['/hello'])
    }

    // otherwise make sure '/hello' === 'world'
    const currentHello = await get('/hello')
    if (currentHello !== 'world') {
        return false
    }

    // but if we're here you've unlocked the asset, yay!
    for (let key of Object.keys(transition.metadata)) {
        await set(key, transition.metadata[key])
    }
}

run()