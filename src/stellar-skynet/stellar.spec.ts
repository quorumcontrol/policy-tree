import 'mocha'
import {expect} from 'chai'
import {StellarBack} from './stellar'
import { openedMemoryRepo } from '../repo'
import Repo from '../repo/datastore'
import fs from 'fs'
import { makeBlock } from '../repo/block'

const setDataBytes = fs.readFileSync('policies/default/setdata/setdata.wasm')

describe('stellar', ()=> {

    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('stellar')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('works', async ()=> {
        const block = await makeBlock(setDataBytes)
        await repo.blocks.put(block)

        const stellar = new StellarBack(repo)

        const did = await stellar.createAsset({ policy: block.cid })
        if (!did) {
            throw new Error("no did returned")
        }

        let tree = await stellar.getAsset(did)
        expect(await tree.lastTransitionSet()).to.be.null
        
        await stellar.transitionAsset({
            type: 'setdata',
            metadata: {
                'key': 'hi',
                'value': 'hi'
            }
        })

        tree = await stellar.getAsset(did)
        expect(await tree.lastTransitionSet()).to.be.not.be.null

        expect((await tree.get('hi'))).to.equal('hi')
    })

})