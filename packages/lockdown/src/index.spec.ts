import 'mocha'
import { expect } from 'chai'
import { Sandbox } from './index'


describe("sanity", ()=> {
    it('runs', async ()=> {
        const sandbox = new Sandbox({
            print: harden(console.log),
        })
        sandbox.evaluate(`
            print('hihi')
        `)
    })
})