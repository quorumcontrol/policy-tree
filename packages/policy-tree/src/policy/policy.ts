import { Sandbox } from 'lockdown'
import { IBlock, decodeBlock, makeBlock } from '../repo/block'
import { Transition } from '../transitionset'
import { BigNumber } from 'bignumber.js'
import { PolicyTreeVersion, ReadOnlyPolicyTreeVersion } from '../policytree'

export interface TreeWriterEndowment {
    setData: PolicyTreeVersion['setData']
    sendToken: PolicyTreeVersion['sendToken']
    receiveToken: PolicyTreeVersion['receiveToken']
    mintToken: PolicyTreeVersion['mint']
}

export interface StandardEndowments {
    getTree: ()=> (TreeWriterEndowment & ReadOnlyPolicyTreeVersion)
    BigNumber: typeof BigNumber
    getTransition: ()=>Transition
    getUniverse: ()=> any
    print: typeof console.log
}

export class Policy {
    private sandbox:Sandbox
    private original:string

    static async create(policyBlock:IBlock) {
        const code = await decodeBlock(policyBlock)
        return new Policy(code)
    }

    constructor(code:string) {
        this.original = code
        this.sandbox = new Sandbox(code) // TODO: opts?
    }

    toBlock() {
        return makeBlock(this.original)
    }

    evaluate(tree:PolicyTreeVersion, transition:Transition, universe?:any):Promise<any> {
        const endowments:StandardEndowments = {
            getTree: ()=> {
                return {
                    ...tree.readOnly(),
                    setData: (key:string, val:any)=> tree.setData(key,val),
                    sendToken: (canonicalTokenName:string, dest:string, amount:BigNumber, nonce:string)=> tree.sendToken(canonicalTokenName, dest, amount, nonce),
                    receiveToken: (canonicalTokenName:string, nonce:string, otherTree: ReadOnlyPolicyTreeVersion)=> tree.receiveToken(canonicalTokenName, nonce, otherTree),
                    mintToken: (tokenName:string, amount:BigNumber)=> tree.mint(tokenName, amount),
                }
            },
            BigNumber: harden(BigNumber),
            getTransition: ()=> transition,
            getUniverse: ()=> harden(universe),
            print: console.log,
        }
        return this.sandbox.evaluate({global: endowments})
    }
}

export default Policy