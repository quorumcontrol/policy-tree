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

    it('gets state at arbitrary heights', async ()=> {
        const store = new VersionStore(repo)
        await store.update((existing)=> {
            existing['test'] = 10
            return existing
        }, 10)

        await store.update((existing)=> {
            existing['test'] = 100
            return existing
        }, 100)
        
        const genesis = await store.stateAt(0)
        expect(genesis['test']).to.be.undefined
        
        const doc11 = await store.stateAt(11)
        expect(doc11['test']).to.equal(10)

        const doc99 = await store.stateAt(99)
        expect(doc99['test']).to.equal(10)

        const doc100 = await store.stateAt(100)
        expect(doc100['test']).to.equal(100)
    })

})