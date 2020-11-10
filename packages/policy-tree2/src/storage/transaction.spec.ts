import 'mocha'
import {expect} from 'chai'
import Repo from './repo'
import { VersionStore } from './versionStore'
import { openedMemoryRepo } from '.'
import { Transaction } from './transaction'

describe('Transaction', ()=> {
    let repo: Repo
    let store:VersionStore

    beforeEach(async () => {
        repo = await openedMemoryRepo('Transaction')
        store = new VersionStore(repo, "vers")
        await store.ready
    })

    afterEach(async () => {
        await repo.close()
    })

    it('does not set store before commit', async ()=> {
        const tx = new Transaction(store, 1)
        await tx.put('test', 'test')
        expect(await store.get('test')).to.be.undefined
    })

    it('commits', async ()=> {
        const tx = new Transaction(store, 1)
        await tx.put('test', 'test')
        expect(await store.get('test')).to.be.undefined
        await tx.commit()
        expect(await store.get('test')).to.equal('test')
        expect(store.currentSnapshot).to.equal(2) // one above commit
    })

    it('gets value from pending', async ()=> {
        const tx = new Transaction(store, 1)
        await tx.put('test', 'test')
        expect(await tx.get('test')).to.equal('test')
    })

})