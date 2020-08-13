import CID from 'cids'
import { makeBlock, IBlock } from './repo/block'

export interface Transition {
    sender?:string // typically a blockchain address
    height?:number
    type:string
    metadata:any
}

interface EnhancedTransition extends Transition {
    cid?:CID
    block?:IBlock
}

export interface CanonicalTransitionSet {
    height: number
    source: string
    transitions: Transition[]
    previous?: string
}

export class TransitionSet {
    source:string
    height:number
    private transitionsHolder:EnhancedTransition[]

    constructor(source: string, height:number, transitions:Transition[]) {
        this.source = source
        this.height = height
        this.transitionsHolder = transitions
    }

    async transitions() {
        await this.order()
        return this.transitionsHolder
    }

    async toCanonicalObject():Promise<CanonicalTransitionSet> {
        await this.order()
        return {
            height: this.height,
            source: this.source,
            transitions: this.transitionsHolder.map((enhancedT)=> {
                const {cid,block, ...originalTrans} = enhancedT
                return originalTrans
            })
        }
    }

    private enhance() {
        return Promise.all(this.transitionsHolder.map((t)=> {
            return new Promise(async (resolve)=> {
                if (t.block) {
                    // this means we already did this
                    resolve()
                    return
                }
                const b = await makeBlock(t)
                t.block = b
                t.cid = b.cid
                resolve()
            })
        }))
    }

    private async order() {
        await this.enhance()
        this.transitionsHolder.sort((ta,tb)=> {
            const a = ta.cid!.toString()
            const b = tb.cid!.toString()
            if (a > b) {
                return 1
            }
            if (a < b) {
                return -1
            }
            return 0
        })
    }

}