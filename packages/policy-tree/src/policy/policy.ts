import { Sandbox } from 'lockdown'
import { IBlock, decodeBlock, makeBlock } from '../repo/block'
import { PolicyTree, canonicalTokenName, ReadOnlyTree } from '../policytree'
import { Transition } from '../transitionset'
import { BigNumber } from 'bignumber.js'
import { stringify } from 'querystring'

export class Policy {
    private sandbox:Sandbox
    private original:string
    private universe?:any

    static async create(policyBlock:IBlock, universe?:any) {
        const code = await decodeBlock(policyBlock)
        return new Policy(code, universe)
    }

    constructor(code:string, universe?:any) {
        this.original = code
        this.universe = universe
        this.sandbox = new Sandbox(code) // TODO: opts?
    }

    toBlock() {
        return makeBlock(this.original)
    }

    evaluate(tree:PolicyTree, transition:Transition):Promise<any> {
        return this.sandbox.evaluate({
            getTree: ()=> {
                return {
                    ...tree.readOnly(),
                    setData: (key:string, val:any)=> tree.setData(key,val),
                    sendToken: (canonicalTokenName:string, dest:string, amount:BigNumber, nonce:string)=> tree.sendToken(canonicalTokenName, dest, amount, nonce),
                    receiveToken: (canonicalTokenName:string, nonce:string, otherTree: ReadOnlyTree)=> tree.receiveToken(canonicalTokenName, nonce, otherTree),
                    mintToken: (tokenName:string, amount:BigNumber)=> tree.mint(tokenName, amount),
                }
            },
            BigNumber: harden(BigNumber),
            getTransition: ()=> transition,
            getUniverse: ()=> harden(this.universe),
            print: console.log,
        })
    }
}

export default Policy