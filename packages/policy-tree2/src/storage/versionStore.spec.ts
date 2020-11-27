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
        store = new VersionStore(repo, "vers")
        await store.ready
    })

    afterEach(async () => {
        await repo.close()
    })

    it('sets and gets', async () => {
        await store.put("test", "test")
        expect(await store.get('test')).to.equal('test')
    })

    it('basic versions', async ()=> {
        await store.put("test", "test")
        await store.snapshot(1)
        await store.put('test', 'test2')
        await store.snapshot(2)
        expect(await store.get('test')).to.equal('test2')
        expect(await store.getAt('test', 1)).to.equal('test')
        expect(await store.getAt('test', 2)).to.equal('test2')
    })

    it('complex versions', async ()=> {
        await store.put("test", "test")
        await store.snapshot(1)
        await store.put('createdIn1', true)
        await store.put('test', 'test2')
        await store.snapshot(10)
        
        await store.put('createdIn1', 'updated')

        expect(await store.getAt('createdIn1', 2)).to.equal(true)

    })



})