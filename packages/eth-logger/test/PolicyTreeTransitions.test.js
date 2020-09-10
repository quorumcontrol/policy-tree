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

    it('logs multiple transitions', async function() {
        const makeLog = (i) => {
            const characterCount = 20
            let str = i.toString(10)
            for (let i = 0; i < characterCount; i++) {
                str = `${str}-${i}-`
            }
            const buf = Buffer.from(str)
            return [buf.slice(0, 32), buf]
        }
        let logs = []
        for (let i = 0; i < 10; i++) {
            logs.push(makeLog(i))
        }

        const blooms = logs.map((l) => l[0])
        const transitions = logs.map((l) => l[1])

        const res = await this.policyTreeTransitionContract.logMultiple(blooms, transitions, { from: accounts[0] });
        expect(res.logs).to.have.lengthOf(10)
        for (let i = 0; i < 10; i++) {
            const hex = res.logs[i].args.transition
            expect(Buffer.from(hex.slice(2), 'hex').toString()).to.equal(transitions[i].toString())
        }
    })

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