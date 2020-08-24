import { Sandbox } from 'lockdown'
import { IBlock, decodeBlock, makeBlock } from '../repo/block'
import { PolicyTree } from '../policytree'
import { Transition } from '../transitionset'


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

    evaluate(tree:PolicyTree, transition:Transition):Promise<any> {
        return this.sandbox.evaluate({
            getTransition: ()=> transition,
            get: (key:string)=>tree.get(key),
            set: (key:string, val:any)=> tree.set(key,val)
        })
    }
}

export default Policy