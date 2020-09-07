const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { expect } = require('chai');
const log = require('debug')('heaventest')

const HeavenToken = contract.fromArtifact('HeavenToken');

const FWEI = 0;
const MANA = 1;

describe('HeavenToken', function() {
    const [owner, alice, bob] = accounts;

    beforeEach(async function() {
        this.heavenToken = await HeavenToken.new({ from: owner });
    });

    it('elevates', async function() {
        const val = 100000
        const hsh = web3.utils.keccak256("test")

        await this.heavenToken.deposit({ from: alice, value: val })
        await this.heavenToken.convertFWEIToMana(val, { from: alice })
        expect((await this.heavenToken.balanceOf(alice, MANA)).toString()).to.equal(val.toString())
        const resp = await this.heavenToken.elevate(val, hsh, { from: alice })
        expect((await this.heavenToken.balanceOf(alice, MANA)).toString()).to.equal("0")
        console.log("resp: ", resp)
        expect(resp.logs[1].event).to.equal('Elevate')
        expect(resp.logs[1].args.from).to.equal(alice)
        expect(resp.logs[1].args.amount.toString()).to.equal(val.toString())
        expect(resp.logs[1].args.destination).to.equal(hsh)
    })

    describe('offer handling', () => {
        it('transfers FETH the first time, but fails trying to reuse data', async function() {
            await this.heavenToken.deposit({ from: owner, value: 100000 })

            const hsh = web3.utils.keccak256("test")
            await this.heavenToken.handleOffer(hsh, alice, 100, { from: owner })

            // however using the same one fails
            try {
                await this.heavenToken.handleOffer(hsh, alice, 100, { from: owner })
                expect(false).to.be.true("", "This shouldn't happen, the payment should not succeed")
            } catch (err) {
                expect(err.message).to.include("the offer must not exist in the mapping")
            }
            // but a different one succeeds
            const hsh2 = web3.utils.keccak256("test2")

            await this.heavenToken.handleOffer(hsh2, alice, 100, { from: owner })
        });

        it('logs OfferHandled', async function() {
            await this.heavenToken.deposit({ from: owner, value: 100000 })

            const hsh = web3.utils.keccak256("test")
            const resp = await this.heavenToken.handleOffer(hsh, alice, 100, { from: owner })

            expect(resp.logs[1].args.offer).to.equal(hsh)
            expect(resp.logs[1].args.to).to.equal(alice)
            expect(resp.logs[1].args.amount.toString()).to.equal('100')
        })
    })

    describe('fwei handling', () => {
        let depAmount

        beforeEach(async function() {
            depAmount = web3.utils.toWei("0.25", 'ether');
            await this.heavenToken.deposit({ from: alice, value: depAmount })
        })

        it('accepts eth and creates FWEI', async function() {
            expect((await this.heavenToken.balanceOf(alice, FWEI)).toString()).to.equal(depAmount)
        })

        it('allows withdrawl', async function() {
            await this.heavenToken.convertFWEIToEth(depAmount, { from: alice })

            const initial = new web3.utils.BN(await web3.eth.getBalance(alice))

            await this.heavenToken.withdrawPayments(alice, { from: alice })
            expect((await this.heavenToken.balanceOf(alice, FWEI)).toNumber()).to.equal(0)

            const after = new web3.utils.BN(await web3.eth.getBalance(alice))
            expect(parseFloat(web3.utils.fromWei(after.sub(initial)))).to.closeTo(parseFloat(web3.utils.fromWei(depAmount)), 0.002)
        })
    })


});