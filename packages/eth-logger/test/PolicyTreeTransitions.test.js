const { accounts, contract } = require('@openzeppelin/test-environment');
const { expect } = require('chai');

const PolicyTreeTransitions = contract.fromArtifact('PolicyTreeTransitions');


describe('PolicyTreeTransitions', function() {
    const [owner] = accounts;

    beforeEach(async function() {
        this.policyTreeTransitionContract = await PolicyTreeTransitions.new({ from: owner });
    });

    it('the deployer is the owner', async function() {
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
});