import 'mocha'
import {expect} from 'chai'
import Repo from './repo'
import { openedMemoryRepo } from '.'
import {VersionStore} from './versionStore'
import { CborStore } from './cborStore'


describe('VersionStore', ()=> {
    let repo: Repo
    let store:VersionStore
    beforeEach(async () => {
        repo = await openedMemoryRepo('VersionStore')
        const cborStore = new CborStore(repo, "vers")
        store = new VersionStore(cborStore)
        await store.ready
    })

    afterEach(async () => {
        await repo.close()
    })

    it('sets and gets', async () => {
        await store.put("test", "test")
        expect(await store.get('test')).to.equal('test')
    })

    it('versions', async ()=> {
        await store.put("test", "test")
        await store.snapshot(1)
        await store.put('test', 'test2')
        expect(await store.get('test')).to.equal('test2')
        expect(await store.valueAt('test', 1)).to.equal('test')
    })


})