import 'mocha'
import { expect } from 'chai'
import { Sandbox } from './index'
import 'ses'

const code = `
function sleep(time) {
    return new Promise((resolve)=> {
        setTimeout(resolve, time);
    })
}

async function run() {
    await sleep(200)
    print('hi')
    return 'hi'
}
run()
`

describe("sanity", ()=> {
    it('runs', async ()=> {
        const sandbox = new Sandbox(code, {
            endowments: {
                setTimeout: setTimeout,
            }
        })
        const result = await sandbox.evaluate({
            print: harden(console.log)
        })
        expect(result).to.equal('hi')
    })
})