const { setData, getData } = getTree()

async function run() {
    const transition = await getTransition()
    switch (transition.type) {
        case -1:
            // do nothing on genesis
            return true
        case 2:
            const metadata = transition.metadata
                // always allow setting the /hello key
            if (metadata['/hello']) {
                return setData('/hello', metadata['/hello'])
            }

            // otherwise make sure '/hello' === 'world'
            const currentHello = await getData('/hello')
            if (currentHello !== 'world') {
                return false
            }

            // but if we're here you've unlocked the asset, yay!
            for (let key of Object.keys(transition.metadata)) {
                await setData(key, transition.metadata[key])
            }
            return true
        default:
            return false
    }
}

run()