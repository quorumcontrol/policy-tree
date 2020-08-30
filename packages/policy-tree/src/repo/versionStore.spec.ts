import 'mocha'
import { expect } from 'chai'
import Repo, { Key } from './repo'
import { openedMemoryRepo } from '.'
import {VersionStore} from './versionStore'


describe('VersionStore', ()=> {
    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('CborStore')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('sets and gets', async ()=> {
        const store = new VersionStore(repo)
        await store.update((existing)=> {
            existing['test'] = 'test'
            return existing
        }, 10)
        expect(await store.get('test')).to.equal('test')
    })

    it('returns undefined for unknown get', async ()=> {
        const store = new VersionStore(repo)
        expect(await store.get('not-set')).to.be.undefined
    })

    it.skip('handles big updates', async ()=> {
        const store = new VersionStore(repo)

        const iterations = 1000

        for (let i = 0; i < iterations; i++) {
            await store.update((existing)=> {
                // for (let i = 0; i < iterations; i++) {
                    existing[`test-${i}`] = 'test'
                // }
                return existing
            }, i)
        }

        for (let i = 0; i < iterations; i++) {
            expect(await store.get(`test-${i}`)).to.equal('test')
        }
    })

})