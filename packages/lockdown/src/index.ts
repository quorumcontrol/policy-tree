import 'ses'
import { makeMeteringTransformer, makeMeter } from '@agoric/transform-metering/dist/transform-metering.cjs';
import * as babelCore from '@babel/core';

declare const lockdown:any;
declare class Compartment {
    constructor(opts: any);
    evaluate(code:string):any;
}

const transformer = makeMeteringTransformer(babelCore)

lockdown({ errorTaming: 'unsafe' })

// see https://github.com/Agoric/agoric-sdk/blob/f755266d57c9358cd1c247eebd57f574ba892b01/packages/transform-metering/src/constants.js
interface SandboxOpts {
    budgets?: {
        budgetCombined?: number,
        budgetAllocate?: boolean,
        budgetCompute?: boolean,
        budgetStack?: number,
    },
    endowments?: {[key:string]:any}
}

const defaultBudgets = {
    budgetCombined: 10000,    
}

const defaultEndowments = {}

const defaultSandboxOpts = {
    budgets: defaultBudgets,
    endowments: defaultEndowments,
}

export class Sandbox {
    compartment:Compartment
    meter: any
    refillFacet: any
    transformed: any

    constructor(code:string, opts:SandboxOpts=defaultSandboxOpts) {
        const budgets = {...defaultBudgets, ...opts.budgets}
        const endowments = {...defaultEndowments, ...opts.endowments}

        const { meter, refillFacet } = makeMeter(budgets);
        this.refillFacet = refillFacet
        const hardenedMeter = harden(meter)
        this.meter = hardenedMeter
        const getMeter = ()=> hardenedMeter

        const transformed = transformer.rewrite({
            src: code,
            endowments: { getMeter },
            sourceType: 'script',
        })
        this.transformed = transformed

        this.compartment = new Compartment({...endowments, ...transformed.endowments})
    }

    evaluate() {
        return this.compartment.evaluate(this.transformed.src)
    }
}

