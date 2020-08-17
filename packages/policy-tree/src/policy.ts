import { IBlock,decodeBlock } from "./repo/block"
//types are coming soon
const { loadPolicy } = require("@open-policy-agent/opa-wasm")

export class Policy {
    private policyPromise:Promise<any>

    constructor(policyBlock:IBlock) {
        this.policyPromise = new Promise(async (resolve)=> {
            resolve(loadPolicy((await decodeBlock(policyBlock))))
        })
    }

    async evaluate<T=any>(input:any):Promise<T> {
        const policy = await this.policyPromise
        return policy.evaluate(input)[0].result
    }
}

export default Policy