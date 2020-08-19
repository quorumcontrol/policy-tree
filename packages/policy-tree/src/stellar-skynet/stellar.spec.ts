import 'mocha'
import {expect} from 'chai'
import {StellarBack} from './stellar'
import { openedMemoryRepo } from '../repo'
import Repo from '../repo/datastore'
import fs from 'fs'
import { makeBlock } from '../repo/block'

const setDataBytes = fs.readFileSync('policies/default/setdata/setdata.wasm')

const aliceKeys = {
    publicKey: 'GBE3HUH4YAWYOUU4NISEIRAUVTXCUZUBMD6FPDSOHDWGGJEJJBH22TMD',
    privateKey: 'SBZGFEQ2HN7TLPZTD4QJLVPBYF64R532UYDF2TYX5U74QT6GI2Z6ULQM'
}

const bobKeys = {
    publicKey: 'GCCYWPBKXL2OABFNFXZZ7VS4NXWW5RNTHOVV5YW4ECVGHXUJX3O2QG4E',
    privateKey: 'SD7UNC7BX3JIYTYS66UDNOK4YUPGYM5ZHB2GB7LW6BTJFWILZPP67CRF'
}


describe('stellar', ()=> {

    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('stellar')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('creates and transitions', async ()=> {
        const block = await makeBlock(setDataBytes)
        await repo.blocks.put(block)

        const stellar = new StellarBack(repo, aliceKeys)

        const [did,] = await stellar.createAsset({ policy: block.cid })
        if (!did) {
            throw new Error("no did returned")
        }

        let tree = await stellar.getAsset(did)
        expect(await tree.lastTransitionSet()).to.be.null
        
        await stellar.transitionAsset(did, {
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

    it('messages', async ()=> {
        const bobRepo = await openedMemoryRepo('stellar-bob')
        try {
            const block = await makeBlock(setDataBytes)
            await repo.blocks.put(block) // notice that we don't put the policy into bob's repo, he'll get it from the asset
            const aliceStellar = new StellarBack(repo, aliceKeys)
            const bobStellar = new StellarBack(bobRepo, bobKeys)

            const [did,] = await aliceStellar.createAsset({ 
                policy: block.cid,
                messageAccount: aliceKeys.publicKey,
            })
            if (!did) {
                throw new Error("no did returned")
            }
    
            let tree = await aliceStellar.getAsset(did)
            expect(await tree.lastTransitionSet()).to.be.null
            
            await aliceStellar.transitionAsset(did, {
                type: 'setdata',
                metadata: {
                    'key': 'hi',
                    'value': 'hi'
                }
            })

            try {
                await bobStellar.messageAsset(did, {
                    type: 'setdata',
                    metadata: {
                        'key': 'bob',
                        'value': 'setthis'
                    }
                })
            } catch(err) {
                console.error("error messaging: ", err, "extras: ", err.response.data.extras)
                throw err
            }
            
            // sanity check that a blank bob has worked
            tree = await bobStellar.getAsset(did)
            expect(await tree.lastTransitionSet()).to.be.not.be.null
    
            expect((await tree.get('hi'))).to.equal('hi')
            expect((await tree.get('bob'))).to.equal('setthis')


        } catch(err) {
            throw err
        } finally {
            bobRepo.close()
        }
    })

})