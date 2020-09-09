import Repo from "./repo"
export * from './repo'
export * from './block'

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
    return new Repo(path, memRepoOpts)
}

export async function openedMemoryRepo(path: string) {
    const repo = memoryRepo(path)
    await repo.init({})
    await repo.open()
    return repo
}
