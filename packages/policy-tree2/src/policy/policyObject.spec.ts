import 'mocha'
import {expect} from 'chai'
import {Repo, VersionStore, openedMemoryRepo} from '../storage'
import {PolicyObject} from './policyObject'

describe('PolicyObject', ()=> {
    let repo: Repo

    beforeEach(async () => {
        repo = await openedMemoryRepo('PolicyObject')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('genesis', async ()=> {
        const obj = await PolicyObject.genesis('test', repo, 22, {test:true})
        expect(await obj.get('test')).to.equal(true)
        expect(await obj.valueAt('test', 22)).to.equal(true)
    })

    it('transacts', async ()=> {
        const obj = await PolicyObject.genesis('test', repo, 22, {test:true})
        const tx = obj.transact(23)
        await tx.put('test', 'new')
        await tx.commit()
        expect(await obj.get('test')).to.equal('new')
        expect(await obj.valueAt('test', 22)).to.equal(true)
        expect(await obj.valueAt('test', 23)).to.equal('new')
    })

})