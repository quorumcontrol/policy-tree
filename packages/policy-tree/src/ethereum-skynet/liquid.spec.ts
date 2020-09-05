import 'mocha'
import { expect } from 'chai'
import { EthereumBack, signer, provider } from './ethereum'
import { openedMemoryRepo } from '../repo'
import { makeBlock } from '../repo/block'
import fs from 'fs'
import Repo from '../repo/repo'
import { TransitionTypes } from '../transitionset'
import { canonicalTokenName } from '../policytree/policytreeversion'
import HeavenTokenJSON from './HeavenToken.json'
import { Contract, providers, EventFilter, utils, BigNumber } from 'ethers'

const liquidContract = fs.readFileSync('../policy-tree-policies/lib/liquid.js').toString()
const ethStandardContract = fs.readFileSync('../policy-tree-policies/lib/ethstandard.js').toString()

export const heavenToken = new Contract(HeavenTokenJSON.networks['33343733366'].address, HeavenTokenJSON.abi, signer)


describe('liquid', ()=> {
    let repo: Repo
    beforeEach(async () => {
        repo = await openedMemoryRepo('ethereum')
    })

    afterEach(async () => {
        await repo.close()
    })

    it('creates and transitions', async ()=> {
        const liquidContractBlock = await makeBlock(liquidContract)
        const standardContract = await makeBlock(ethStandardContract)
        await repo.blocks.put(liquidContractBlock)
        await repo.blocks.put(standardContract)

        const eth = new EthereumBack(repo)
        const bob = provider.getSigner(1)

        const [did,] = await eth.createAsset({ 
            policy: liquidContractBlock.cid,
            metadata: {
                erc20ContractAddress: heavenToken.address,
                destinationAddress: await bob.getAddress(),
                token: 'mana',
            }
        })
        const [bobDid,] = await eth.createAsset({ 
            policy: standardContract.cid,
        })

        const resp:providers.TransactionReceipt = await heavenToken.safeTransferFrom(await signer.getAddress(), await bob.getAddress(), 0, 1, '0x')

        eth.transitionAsset(did, {
            type: 4,
            metadata: {
                block: resp.blockNumber,
                dest: bobDid,
            }
        })

        const after = await eth.getAsset(did)
        const cur = await after.current()
        expect(cur.getBalance(canonicalTokenName(did, 'mana')).toNumber()).to.equal(999)
        
    })
})
