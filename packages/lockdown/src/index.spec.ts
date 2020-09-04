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

    it('prevents massive allocation', async ()=> {
        const sandbox = new Sandbox(`
            Array(100000)
        `)
        try {
            await sandbox.evaluate({
                print: harden(console.log)
            })
        } catch(err) {
            expect(err.message).to.include("Exceeding maximum")
            return
        }
        expect(false).to.be.true // should never get here
    })
})