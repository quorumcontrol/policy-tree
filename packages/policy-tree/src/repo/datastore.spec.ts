import 'mocha'
import { expect } from 'chai'
import Repo, { Key } from './repo'
import { openedMemoryRepo } from '.'
import {CborStore} from './datastore'

const dagCBOR = require('ipld-dag-cbor')

describe('CborStore', ()=> {
    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('CborStore')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('sets and gets', async ()=> {
        const store = new CborStore(repo)
        await store.put("test", "test")
        expect(await store.get('test')).to.equal('test')
    })

    it('returns undefined for unknown get', async ()=> {
        const store = new CborStore(repo)
        expect(await store.get('not-set')).to.be.undefined
    })

    it('namespaces', async ()=> {
        const store = new CborStore(repo, "test")
        await store.put("test", "test")
        expect(await store.get('test')).to.equal('test')
        const encoded = await repo.datastore.get(new Key("test/test"))
        expect(dagCBOR.util.deserialize(encoded)).to.equal('test')
    })
})