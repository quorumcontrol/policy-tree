import 'ses'

declare const lockdown:any;
declare class Compartment {
    constructor(opts: any);
    evaluate(code:string):any;
}

export class Sandbox {
    compartment:Compartment

    constructor(endowment:any) {
        this.compartment = new Compartment(endowment)
    }

    evaluate(code:string) {
        return this.compartment.evaluate(code)
    }
}

lockdown()
