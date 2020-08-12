import CID from 'cids'

const HashMap = require('../hashmap')
// A PolicyTree is a state machine. It starts from a genesis state that defines rules,
// then TransitionSets are played on top of the tree which modify the tree based on that
// genesis policy.

interface ImmutableMap {
    cid:CID
    set:(key:string,value:any)=>Promise<void>
    get:<T>(key:string)=>Promise<T>
    delete:(key:string)=>Promise<void>
}

interface ConversionResponse {
    valid: boolean
    key?: string
    value?: any
}

interface Policy {
    convert: (transition:Transition, tree:PolicyTree)=>Promise<ConversionResponse>
}

interface Transition {
    type:string
    metadata:any
}

interface TransitionSet {
    height:number
    transitions:Transition[]
}

class PolicyTree {
    hashMap:ImmutableMap

    constructor(store:any,tip?:CID) {
        this.hashMap = HashMap.create(store,tip)
    }

    private async set(key:string,value:any) {
        return this.hashMap.set(key,value)
    }

    get tip() {
        return this.hashMap.cid
    }


    

    
}