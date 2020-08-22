import 'mocha'
import { expect } from 'chai'
import {contract, signer, EthereumBack} from './ethereum'
import { openedMemoryRepo } from '../repo'
import { makeBlock } from '../repo/block'
import fs from 'fs'
import Repo from '../repo/repo'

const setDataBytes = fs.readFileSync('policies/default/setdata/setdata.wasm')

describe('ethereum', ()=> {
    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('ethereum')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('creates and transitions', async ()=> {
        const block = await makeBlock(setDataBytes)
        await repo.blocks.put(block)

        const eth = new EthereumBack(repo)

        const [did,] = await eth.createAsset({ policy: block.cid })
        if (!did) {
            throw new Error("no did returned")
        }
        console.log("did: ", did)

        let tree = await eth.getAsset(did)
        expect(await tree.lastTransitionSet()).to.be.undefined
        
        await eth.transitionAsset(did, {
            type: 'setdata',
            metadata: {
                'key': 'hi',
                'value': 'hi'
            }
        })

        tree = await eth.getAsset(did)
        expect(await tree.lastTransitionSet()).to.exist

        expect((await tree.get('hi'))).to.equal('hi')
    })
})