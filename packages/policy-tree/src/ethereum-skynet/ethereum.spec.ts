import 'mocha'
import { expect } from 'chai'
import { EthereumBack, IDENTITY_BLOOM } from './ethereum'
import { openedMemoryRepo } from '../repo'
import Repo from '../repo/repo'
import { TransitionTypes } from '../transitionset'
import { canonicalTokenName } from '../policytree/policytreeversion'
import { providers, utils, BigNumber, Contract } from 'ethers'
import PolicyTreeTransitionContract from './PolicyTreeTransitions.json'
import HeavenTokenJSON from './HeavenToken.json'
import CID from 'cids'
import {contracts as PolicyFile} from '../../../policy-tree-policies/lib/policies.json'

interface PolicyCIDAndLocator { 
    policy: CID
    policyLocator: string
}

describe('ethereum', () => {
    let repo: Repo
    let eth: EthereumBack
    let contracts: { [key: string]: PolicyCIDAndLocator }

    before(async () => {
        contracts = Object.keys(PolicyFile).reduce((mem, key)=> {
            mem[key] = {
                ...(PolicyFile as any)[key],
                policy: new CID((PolicyFile as any)[key].policy),
            }
            return mem
        }, {} as { [key: string]: PolicyCIDAndLocator })
    })

    beforeEach(async () => {
        repo = await openedMemoryRepo('ethereum')
        const provider = new providers.JsonRpcProvider()
        const signer = provider.getSigner()
        const contractAddress = PolicyTreeTransitionContract.networks['33343733366'].address
        eth = new EthereumBack({ repo, provider, signer, contractAddress })
    })

    afterEach(async () => {
        await repo.close()
    })

    it('creates and transitions', async () => {
        const [did,] = await eth.createAsset({ ...contracts['setData'] })
        if (!did) {
            throw new Error("no did returned")
        }

        let tree = await eth.getAsset(did)

        await eth.transitionAsset(did, {
            type: TransitionTypes.SET_DATA,
            metadata: {
                'hi': 'hi'
            }
        })

        tree = await eth.getAsset(did)

        expect((await tree.current()).getData('hi')).to.equal('hi')
    })

    it('creates identity', async () => {
        const [did,] = await eth.createAsset({ ...contracts['ethStandard'] }, IDENTITY_BLOOM)
        if (!did) {
            throw new Error("no did returned")
        }

        const identityTree = await eth.getIdentity(await eth.signer.getAddress())
        expect(identityTree.did).to.equal(did)
    })

    it('supports a universe', async () => {
        const [did,] = await eth.createAsset({ ...contracts['ethHelloWorld'] })
        if (!did) {
            throw new Error("no did returned")
        }

        let tree = await eth.getAsset(did)
        expect((await tree.current()).height).to.equal(0)

        const transResponse = await eth.transitionAsset(did, {
            type: 1000,
            metadata: {},
        })

        tree = await eth.getAsset(did)

        expect((await tree.current()).getData('block')).to.include({ number: transResponse.blockNumber })
    })

    it('reproducible results based on block height of the transition', async () => {
        const [aliceDid,] = await eth.createAsset({ ...contracts['ethWriteOther'] })
        const [bobDid,] = await eth.createAsset({ ...contracts['ethWriteOther'] })

        // let alice = await eth.getAsset(aliceDid)
        let bob = await eth.getAsset(bobDid)

        // first we transition alice and bob through a few iterations
        await eth.transitionAsset(aliceDid, {
            type: TransitionTypes.SET_DATA,
            metadata: {
                "hi": 1,
            }
        })

        // first we transition alice and bob through a few iterations
        const bobFirstTransTx = await eth.transitionAsset(bobDid, {
            type: 4, // 4 is WRITE_OTHER in the contract
            metadata: {
                did: aliceDid,
            }
        })


        // first we transition alice and bob through a few iterations
        await eth.transitionAsset(aliceDid, {
            type: TransitionTypes.SET_DATA,
            metadata: {
                "hi": 2,
            }
        })

        // first we transition alice and bob through a few iterations
        await eth.transitionAsset(bobDid, {
            type: 4, // 4 is WRITE_OTHER in the contract
            metadata: {
                did: aliceDid,
            }
        })

        bob = await eth.getAsset(bobDid)

        // latest should be 2
        expect((await bob.current()).getData(aliceDid)).to.equal(2)

        // going back in history should show it at 1
        expect((await bob.at(bobFirstTransTx.blockNumber)).getData(aliceDid)).to.equal(1)
    })

    it('sends coins through the standard contract', async () => {
        const [aliceDid,] = await eth.createAsset({ ...contracts['ethStandard'] })
        const [bobDid,] = await eth.createAsset({ ...contracts['ethStandard'] })

        let alice = await eth.getAsset(aliceDid)
        let bob = await eth.getAsset(bobDid)

        await eth.transitionAsset(aliceDid, {
            type: TransitionTypes.MINT_TOKEN,
            metadata: {
                token: 'aliceCoin',
                amount: BigNumber.from(100).toString(),
            },
        })

        await eth.transitionAsset(aliceDid, {
            type: TransitionTypes.SEND_TOKEN,
            metadata: {
                token: canonicalTokenName(alice.did, 'aliceCoin'),
                amount: BigNumber.from(10).toString(),
                dest: bobDid,
                nonce: 'abc',
            },
        })

        await eth.transitionAsset(bobDid, {
            type: TransitionTypes.RECEIVE_TOKEN,
            metadata: {
                token: canonicalTokenName(alice.did, 'aliceCoin'),
                amount: BigNumber.from(10).toString(),
                from: aliceDid,
                nonce: 'abc',
            },
        })

        bob = await eth.getAsset(bobDid)
        expect((await bob.current()).getBalance(canonicalTokenName(alice.did, 'aliceCoin')).toString()).to.equal(BigNumber.from(10).toString())
    })


    describe('liquid', () => {
        let heavenToken: Contract

        beforeEach(async () => {
            heavenToken = new Contract(HeavenTokenJSON.networks['33343733366'].address, HeavenTokenJSON.abi, eth.signer)
        })

        it('descends elevated hwei to hwei', async () => {
            const [did,] = await eth.createAsset({
                ...contracts['liquid'],
                metadata: {
                    contractAddress: heavenToken.address,
                }
            })
            const [bobDid,] = await eth.createAsset({
                ...contracts['ethStandard']
            })

            const [aliceLPDid,] = await eth.createAsset({
                ...contracts['ethStandard']
            })

            const bobSigner = (eth.provider as providers.JsonRpcProvider).getSigner(2)
            const bobEthAddr = await bobSigner.getAddress()

            const resp: providers.TransactionResponse = await heavenToken.elevateEth(utils.id(bobDid), { value: 1000 })
            await eth.transitionAsset(did, {
                type: 4, // elevate
                metadata: {
                    block: resp.blockNumber,
                    dest: bobDid,
                }
            })

            await eth.transitionAsset(bobDid, {
                type: TransitionTypes.RECEIVE_TOKEN,
                metadata: {
                    token: canonicalTokenName(did, 'hwei'),
                    amount: BigNumber.from(1000).toString(),
                    from: did,
                    nonce: resp.hash,
                },
            })

            // now bob sends those back to the main contract to descend them
            await eth.transitionAsset(bobDid, {
                type: TransitionTypes.SEND_TOKEN,
                metadata: {
                    token: canonicalTokenName(did, 'hwei'),
                    amount: BigNumber.from(1000).toString(),
                    dest: did,
                    nonce: 'bobsbigoffer',
                },
            })

            await eth.transitionAsset(did, {
                type: 5, // descend
                metadata: {
                    from: bobDid,
                    nonce: 'bobsbigoffer', // nonce of the sendToken
                    to: bobEthAddr, // eth addr to send HWEI
                },
            })

            const bobAfter = await (await eth.getAsset(bobDid)).current()

            let contractAfter = await (await eth.getAsset(did)).current()

            expect(bobAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(0)
            expect(contractAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(1000)

            await heavenToken.deposit({ value: 1000 })
            // function handleOffer(bytes32 offer, address to, uint256 amount, bytes32 didHash) public {
            const offerHash = utils.id(bobDid + 'bobsbigoffer')
            const handleResp = await heavenToken.handleOffer(offerHash, bobEthAddr, 1000, utils.id(aliceLPDid))

            await eth.transitionAsset(did, {
                type: 6, // notice_descent
                metadata: {
                    offer: offerHash,
                    pay: aliceLPDid,
                    block: handleResp.blockNumber,
                },
            })

            contractAfter = await (await eth.getAsset(did)).current()
            await eth.transitionAsset(aliceLPDid, {
                type: TransitionTypes.RECEIVE_TOKEN,
                metadata: {
                    token: canonicalTokenName(did, 'hwei'),
                    amount: BigNumber.from(1000).toString(),
                    from: did,
                    nonce: offerHash,
                },
            })
            contractAfter = await (await eth.getAsset(did)).current()
            const aliceAfter = await (await eth.getAsset(aliceLPDid)).current()
            expect(contractAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(0)
            expect(aliceAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(1000)
        })

        it('elevates eth to hwei', async () => {
            const [did,] = await eth.createAsset({
                ...contracts['liquid'],
                metadata: {
                    contractAddress: heavenToken.address,
                }
            })
            const [bobDid,] = await eth.createAsset({
                ...contracts['ethStandard']
            })

            const resp: providers.TransactionResponse = await heavenToken.elevateEth(utils.id(bobDid), { value: 1000 })

            await eth.transitionAsset(did, {
                type: 4,
                metadata: {
                    block: resp.blockNumber,
                    dest: bobDid,
                }
            })

            await eth.transitionAsset(bobDid, {
                type: TransitionTypes.RECEIVE_TOKEN,
                metadata: {
                    token: canonicalTokenName(did, 'hwei'),
                    amount: BigNumber.from(1000).toString(),
                    from: did,
                    nonce: resp.hash,
                },
            })

            const bobAfter = await (await eth.getAsset(bobDid)).current()
            const contractAfter = await (await eth.getAsset(did)).current()

            expect(contractAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(0)
            expect(bobAfter.getBalance(canonicalTokenName(did, 'hwei')).toNumber()).to.equal(1000)
        })
    })
})