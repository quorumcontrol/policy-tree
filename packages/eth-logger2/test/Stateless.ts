import { ethers } from "hardhat";
import { BigNumber, Signer, Contract } from "ethers";
import { expect } from "chai";
import { StatelessLogger } from '../types/ethers-contracts/StatelessLogger'

export async function deploy<T=Contract>(name:string, ...args:any):Promise<T> {
    const factory = await ethers.getContractFactory(name)
    const instance = await factory.deploy(...args)
    await instance.deployed()
    return (instance as any) as T
}

describe("Stateless", async () => {
  let logger: StatelessLogger;

  let operator:Signer
  let operatorAddr:string

  let alice:Signer
  let aliceAddr:string

  
  beforeEach(async () => {
    const signers = await ethers.getSigners();

    operator = signers[0]
    operatorAddr = await operator.getAddress()

    alice = signers[1]
    aliceAddr = await alice.getAddress()

    logger = await deploy<StatelessLogger>("StatelessLogger")
  });

  it('logs transition to the transition event', async function() {
    const characterCount = 20
    let str = ""
    for (let i = 0; i < characterCount; i++) {
        str = `${str}-${i}-`
    }

    const transition = Buffer.from(str)
    const res = await logger.log(transition.slice(0, 32), transition);
    const receipt = await res.wait()
    const hex = receipt.events[0].args.data
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

    const res = await logger.logMultiple(blooms, transitions);
    const receipt = await res.wait()
    expect(receipt.logs).to.have.lengthOf(10)
    for (let i = 0; i < 10; i++) {
        const hex = receipt.events[i].args.data
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
    const res = await logger.callDataOnly(transition.slice(0, 32), transition);
    const receipt = await res.wait()
    
    const hex = receipt.events[0].args.bloom
    expect(hex).to.equal('0x' + transition.slice(0, 32).toString('hex'))
    expect(receipt.events[0].args.data).to.equal('0x')
});

})
