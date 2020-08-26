async function run() {
    const transition = getTransition()
    const { eth } = getUniverse()

    if (transition.type !== 'setdata') {
        return false
    }
    const metadata = transition.metadata

    // always allow setting the /hello key
    if (metadata.key === '/hello') {
        return set(metadata.key, metadata.value)
    }

    // otherwise make sure '/hello' === 'world'
    const currentHello = await get('/hello')
    if (currentHello !== 'world') {
        return false
    }

    // but if we're here you've unlocked the asset, yay!
    return set(metadata.key, metadata.value)
}

run()