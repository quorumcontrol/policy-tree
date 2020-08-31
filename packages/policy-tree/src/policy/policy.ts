import { Sandbox } from 'lockdown'
import { IBlock, decodeBlock, makeBlock } from '../repo/block'
import { Transition } from '../transitionset'
import { BigNumber } from 'bignumber.js'
import { stringify } from 'querystring'
import { PolicyTreeVersion, ReadOnlyPolicyTreeVersion } from '../policytree'

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
        return this.sandbox.evaluate({
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
        })
    }
}

export default Policy