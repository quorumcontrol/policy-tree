const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { expect } = require('chai');

const PolicyTreeTransitions = contract.fromArtifact('PolicyTreeTransitions');


describe('PolicyTreeTransitions', function() {
    const [owner] = accounts;

    beforeEach(async function() {
        this.policyTreeTransitionContract = await PolicyTreeTransitions.new({ from: owner });
    });

    it('logs transition to the transition event', async function() {
        const characterCount = 20
        let str = ""
        for (let i = 0; i < characterCount; i++) {
            str = `${str}-${i}-`
        }

        const transition = Buffer.from(str)
        const res = await this.policyTreeTransitionContract.log(transition.slice(0, 32), transition, { from: accounts[0] });
        const hex = res.logs[0].args.transition
        expect(Buffer.from(hex.slice(2), 'hex')).to.have.lengthOf(transition.length)
    });

    it('allows callDataOnly logging', async function() {
        const characterCount = 1024
        let str = ""
        for (let i = 0; i < characterCount; i++) {
            str = `${str}${i}`
        }

        const transition = Buffer.from(str)
        const res = await this.policyTreeTransitionContract.callDataOnly(transition.slice(0, 32), transition, { from: accounts[0] });

        const hex = res.logs[0].args.bloom
        expect(hex).to.equal('0x' + transition.slice(0, 32).toString('hex'))
        expect(res.logs[0].args.transition).to.be.null
    });
});