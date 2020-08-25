const { accounts, contract } = require('@openzeppelin/test-environment');
const { expect } = require('chai');
const log = require('debug')('heaventest')

const HeavenToken = contract.fromArtifact('HeavenToken');

describe('HeavenToken', function() {
    const [owner, alice, bob] = accounts;

    beforeEach(async function() {
        this.heavenToken = await HeavenToken.new({ from: owner });
    });

    it('the initial balance is 1000', async function() {
        expect((await this.heavenToken.balanceOf(owner, 0)).toNumber()).to.equal(100000)
    });

    it('transfers the first time, but fails trying to reuse data', async function() {
        const resp = await this.heavenToken.safeTransferFrom(owner, alice, 0, 1, Buffer.from('hihi'), { from: owner })
        console.log(resp)

        // however using the same one fails
        try {
            await this.heavenToken.safeTransferFrom(owner, alice, 0, 1, Buffer.from('hihi'), { from: owner })
            expect(false).to.be.true("", "This shouldn't happen, the payment should not succeed")
        } catch (err) {
            expect(err.message).to.include("the offer must not exist in the mapping")
        }
        // but a different one succeeds
        await this.heavenToken.safeTransferFrom(alice, bob, 0, 1, Buffer.from('hihi2'), { from: alice })

    });
});