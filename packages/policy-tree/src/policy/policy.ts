import { Sandbox } from 'lockdown'
import { IBlock, decodeBlock, makeBlock } from '../repo/block'
import { Transition } from '../transitionset'
import { BigNumber } from 'ethers'
import { PolicyTreeVersion, ReadOnlyPolicyTreeVersion } from '../policytree'
import debug from 'debug'

const policyLogger = debug('Policy')

export interface TreeWriterEndowment {
    setData: PolicyTreeVersion['setData']
    sendToken: PolicyTreeVersion['sendToken']
    receiveToken: PolicyTreeVersion['receiveToken']
    mintToken: PolicyTreeVersion['mint']
}

export interface StandardEndowments {
    BigNumber: typeof BigNumber
    log: typeof policyLogger
}

export type TransitionTree = (TreeWriterEndowment & ReadOnlyPolicyTreeVersion)

export type HandlerFunc<UniverseType = any> = (tree: TransitionTree, transition: Transition, universe: UniverseType) => Promise<any>

export type HandlerExport<UniverseType = any> = { [key: number]: HandlerFunc<UniverseType> }

export class Policy<UniverseType = any> {
    private sandbox: Sandbox
    private original: string
    private namespace: Promise<HandlerExport<UniverseType>>

    static async create<UniverseType = any>(policyBlock: IBlock) {
        const code = await decodeBlock(policyBlock)
        return new Policy<UniverseType>(code)
    }

    constructor(code: string) {
        this.original = code
        this.sandbox = new Sandbox(code) // TODO: opts?
        this.namespace = this.sandbox.namespace({
            log: harden((...args:any)=> { 
                const [arg1,...rest] = args
                policyLogger(arg1, ...rest) 
            }),
            BigNumber: harden(BigNumber),
        })
    }

    toBlock() {
        return makeBlock(this.original)
    }

    async transition(tree: PolicyTreeVersion, transition: Transition, universe?: UniverseType): Promise<any> {
        const namespace = await this.namespace
        if (!namespace[transition.type]) {
            console.error("undefined type: ", transition.type)
            return false
        }

        const transitionTree = harden({
            ...tree.readOnly(),
            setData: (key: string, val: any) => tree.setData(key, val),
            sendToken: (canonicalTokenName: string, dest: string, amount: BigNumber, nonce: string) => tree.sendToken(canonicalTokenName, dest, amount, nonce),
            receiveToken: (canonicalTokenName: string, nonce: string, otherTree: ReadOnlyPolicyTreeVersion) => tree.receiveToken(canonicalTokenName, nonce, otherTree),
            mintToken: (tokenName: string, amount: BigNumber) => tree.mint(tokenName, amount),
        })

        return namespace[transition.type](transitionTree, transition, harden(universe))
    }

}

export default Policy