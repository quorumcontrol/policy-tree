import CID from 'cids'
import { makeBlock, IBlock } from './repo/block'

export enum TransitionTypes {
    GENESIS = -1,
    SEND_TOKEN = 0,
    RECEIVE_TOKEN = 1,
    SET_DATA = 2,
    MINT_TOKEN = 3,
}

export interface Transition {
    sender?:string // typically a blockchain address
    height?:number
    type:number
    metadata:{[key:string]:any}
}

// array where first element is type and next element is an array of [key,value] pairs
export type SerializableTransition = [number, [string,any][]?]

export function serializableTransition(trans:Transition):SerializableTransition {
    const serializedObj:SerializableTransition = [trans.type]
    serializedObj.push(Object.keys(trans.metadata).map((key):[string,any]=> {
        return [key,trans.metadata[key]]
    }))
    return serializedObj
}

export function transFromSerializeableTransition(strans:SerializableTransition):Transition {
    const metadata = (strans[1] || []).reduce((metaMemo:Transition['metadata'], keyValue)=> {
        metaMemo[keyValue[0]] = keyValue[1]
        return metaMemo
    }, {})
    return {
        type: strans[0],
        metadata: metadata
    }
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