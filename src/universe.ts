import { PolicyTree } from "./policytree";


/**
 * A universe is an interface to the underlying ledger that's standardized for the PolicyTree engine. 
 * The underlying ledger doesn't need to support much besides block height and allowing transactions to include memos.
 * Transitions from all various accounts should be grouped into a TransitionSet which is then ordered lexically according
 * to their CIDs. The universe must also include a way to have both locally persisted and globally persisted state.
 * 
 * For example: using stellar as a ledger and SIA SkyNet as a globally persisted state. 
 */
 export interface Universe {
    name:string
    localStore: any
    globalStore: any
    get: (did:string)=>Promise<PolicyTree>
 }