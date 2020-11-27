import 'mocha'
import {expect} from 'chai'
import {VM} from './vm'
import { openedMemoryRepo, Repo, Transaction, VersionStore } from '../storage'


describe('VM', ()=> {
    let vm:VM
    let repo: Repo
    let store:VersionStore

    beforeEach(async () => {
        repo = await openedMemoryRepo('VM')
        store = new VersionStore(repo, "VMtest")
        await store.ready
    })

    afterEach(async ()=> {
        await repo.close()
        if (vm) {
            vm.dispose()
        }
    })

    it('evals setup code', async ()=> {
        vm = new VM()
        await vm.initialize('function main(a) { return a }')
    })

    it ('transacts', async ()=> {
        const tx = new Transaction(store, 1)

        vm = new VM()
        await vm.initialize(`async function main(tx, a) {
            // throw new Error('test')
            await tx.put('a', '{"a":' + a + '}');
            return true;
        }`)
        vm.transact(tx, "a")
    })

})
