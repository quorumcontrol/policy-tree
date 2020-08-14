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

export type Metadata = {[key:string]:any}

export interface CanonicalTransitionSet {
    height: number
    source: string
    transitions: Transition[]
    metadata:Metadata
    previous?: string
}

interface TransitionSetConstructor {
    source: string
    height: number
    transitions:Transition[]
    metadata?:Metadata
    previous?:string
}

export class TransitionSet {
    source:string
    height:number
    metadata:Metadata
    previous?:string
    private transitionsHolder:EnhancedTransition[]

    static fromCanonical(obj:CanonicalTransitionSet) {
        return new TransitionSet(obj)
    }

    constructor({source,height,transitions,previous,metadata = {}}:TransitionSetConstructor) {
        this.source = source
        this.height = height
        this.transitionsHolder = transitions
        this.metadata = metadata
        this.previous = previous
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
            }),
            metadata: this.metadata,
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