import 'mocha'
import { expect } from 'chai'
import Repo, { Key } from './repo'
import { openedMemoryRepo } from '.'
import { CborStore } from './cborStore'

const dagCBOR = require('ipld-dag-cbor')

describe('CborStore', () => {
    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('CborStore')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('sets and gets', async () => {
        const store = new CborStore(repo)
        await store.put("test", "test")
        expect(await store.get('test')).to.equal('test')
    })

    it('returns undefined for unknown get', async () => {
        const store = new CborStore(repo)
        expect(await store.get('not-set')).to.be.undefined
    })

    it('namespaces', async () => {
        const store = new CborStore(repo, "test")
        await store.put("test", "test")
        expect(await store.get('test')).to.equal('test')
        const encoded = await repo.datastore.get(new Key("test/test"))
        expect(dagCBOR.util.deserialize(encoded)).to.equal('test')
    })

    describe('querying', () => {
        it('works without a namespace', async () => {
            const store = new CborStore(repo)
            await store.put("test", "test")

            let list = []
            for await (const value of store.query({ prefix: new Key('test') })) {
                list.push(value)
            }

            expect(list).to.have.lengthOf(1)
            expect(list[0].value).to.equal('test')
            expect(list[0].key.toString()).to.equal('/test')
        })

        it('works with a namespace', async () => {
            const store = new CborStore(repo, "namespaced")
            await store.put("test", "test")

            let list = []
            for await (const value of store.query({ prefix: 'test' })) {
                list.push(value)
            }

            expect(list).to.have.lengthOf(1)
            expect(list[0].value).to.equal('test')
            expect(list[0].key.toString()).to.equal('/test')
        })
    })


})