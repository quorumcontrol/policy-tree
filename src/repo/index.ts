const IpfsRepo = require('ipfs-repo')
const MemoryStore = require('interface-datastore').MemoryDatastore
const memoryLock = require('ipfs-repo/src/lock-memory')

const memRepoOpts = {
    fs: MemoryStore,
    storageBackends: {
        root: MemoryStore,
        blocks: MemoryStore,
        keys: MemoryStore,
        datastore: MemoryStore,
        pins: MemoryStore,
    },
    level: require('memdown'),
    lock: memoryLock,
}

export function memoryRepo(path:string) {
    return new IpfsRepo(path, memRepoOpts)
}

export async function openedMemoryRepo(path: string) {
    const repo = memoryRepo(path)
    await repo.init({})
    await repo.open()
    return repo
}