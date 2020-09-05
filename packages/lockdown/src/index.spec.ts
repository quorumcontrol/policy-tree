import 'mocha'
import { expect } from 'chai'
import { Sandbox } from './index'
import 'ses'


describe("sanity", () => {
    it('runs', async () => {
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

    it('prevents massive allocation', async () => {
        const sandbox = new Sandbox(`
            Array(100000)
        `)
        try {
            await sandbox.evaluate({
                print: harden(console.log)
            })
        } catch (err) {
            expect(err.message).to.include("Exceeding maximum")
            return
        }
        expect(false).to.be.true // should never get here
    })

    it('imports', async () => {
        const code = `
            module.exports = {
                test: true,
                toomuchallocation: ()=> {
                    return Array(100000)
                },
                toomuchcompute: ()=> {
                    let num = 0
                    for (let i = 0; i < 100000; i++) {
                        num += i
                    }
                    return num
                },
                edgeOfCompute: ()=> {
                    let num = 0
                    for (let i = 0; i < 10000; i++) {
                        num += i
                    }
                    return num
                }
            }
        `
        const sandbox = new Sandbox(code)
        const namespace = await sandbox.namespace()
        // console.log("namesapce: ", namespace)
        expect(namespace.test).to.be.true
        expect(namespace.toomuchallocation).to.throw('Exceeding maximum size of 10000')
        expect(namespace.toomuchcompute).to.throw('Compute meter exceeded')
        expect(namespace.edgeOfCompute).to.not.throw
        // but then *does* throw the 2nd time
        expect(namespace.edgeOfCompute).to.throw('Compute meter exceeded')
        // but then we can refill
        sandbox.refillFacet.combined(10000)
        expect(namespace.edgeOfCompute).to.not.throw
        expect(namespace.edgeOfCompute).to.throw('Compute meter exceeded')
    })
})