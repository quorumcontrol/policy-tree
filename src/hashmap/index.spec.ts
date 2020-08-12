import 'mocha'
import {expect} from 'chai'
import {openedMemoryRepo} from '../repo'

const HashMap = require('./index')

describe('HashMap', ()=> {

    it('sets', async ()=> {
        const repo = await openedMemoryRepo('HashMap/sets')

        const map = await HashMap.create(repo.blocks)
        await map.set("test", 'hi')
        expect(await map.get('test')).to.equal('hi')
        await repo.close()
    })

})