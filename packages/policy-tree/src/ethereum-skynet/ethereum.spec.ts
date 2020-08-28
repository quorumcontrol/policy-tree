import 'mocha'
import { expect } from 'chai'
import {contract, signer, EthereumBack} from './ethereum'
import { openedMemoryRepo } from '../repo'
import { makeBlock } from '../repo/block'
import fs from 'fs'
import Repo from '../repo/repo'
import { TransitionTypes } from '../transitionset'

const setDataContract = fs.readFileSync('policies/javascript/setdata.js').toString()
const ethHelloWorldContract = fs.readFileSync('policies/javascript/ethhelloworld.js').toString()

describe('ethereum', ()=> {
    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('ethereum')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('creates and transitions', async ()=> {
        const block = await makeBlock(setDataContract)
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
            type: TransitionTypes.SET_DATA,
            metadata: {
                'hi':'hi'
            }
        })

        tree = await eth.getAsset(did)
        expect(await tree.lastTransitionSet()).to.exist

        expect((await tree.getData('hi'))).to.equal('hi')
    })

    it('supports a universe', async ()=> {
        const block = await makeBlock(ethHelloWorldContract)
        await repo.blocks.put(block)

        const eth = new EthereumBack(repo)

        const [did,] = await eth.createAsset({ policy: block.cid })
        if (!did) {
            throw new Error("no did returned")
        }
        console.log("did: ", did)

        let tree = await eth.getAsset(did)
        expect(await tree.lastTransitionSet()).to.be.undefined
        
        const transResponse = await eth.transitionAsset(did, {
            type: 1000,
            metadata: {},
        })

        tree = await eth.getAsset(did)
        expect(await tree.lastTransitionSet()).to.exist

        expect((await tree.getData('block'))).to.include({number: transResponse.blockNumber})
    })

    
})