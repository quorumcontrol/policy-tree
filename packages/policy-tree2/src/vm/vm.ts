import { getQuickJS, QuickJS, QuickJSEvalOptions, QuickJSHandle, QuickJSVm, Scope, shouldInterruptAfterDeadline } from 'quickjs-emscripten'
import { Transaction } from '../storage'

interface Environment {
  get(key:string):Promise<any>
  set(key:string, value:any):Promise<void>
}

export class VM {
    vm?:QuickJSVm
    private scope:Scope

    private json:QuickJSHandle
    private jsonStringify:QuickJSHandle
    private main:QuickJSHandle

    async initialize(setupCode:string) {
        const QuickJS = await getQuickJS()
        this.scope = new Scope()
        this.vm = this.scope.manage(QuickJS.createVm())
        this.vm.setInterruptHandler(this.interruptHandler.bind(this))
        this.eval(setupCode)

        this.json = this.scope.manage(this.vm.getProp(this.vm.global, 'JSON'))
        this.jsonStringify = this.scope.manage(this.vm.getProp(this.json, 'stringify'))

        this.main = this.scope.manage(this.vm.getProp(this.vm.global, 'main'))
    }

    private eval<T=any>(code:string):T {
      return this.scope.manage(this.vm?.unwrapResult(this.vm?.evalCode(code))) as any as  T
    }

    transact(tx:Transaction, data:string) {
      const vm = this.vm
      const json = this.json
      const stringify = this.jsonStringify
      const main = this.main
      Scope.withScope((scope)=> {
        const putFn = scope.manage(this.vm.newFunction('putFn', (keyHandle, valueHandle)=> {
          const key = vm.getString(keyHandle)
          const valueStrHandle = scope.manage(vm.unwrapResult(vm.callFunction(stringify, json, valueHandle)))
          const valueStr = vm.getString(valueStrHandle)

          const deferred = scope.manage(vm.newPromise())
          console.log(key, JSON.parse(valueStr))
          tx.put(key, JSON.parse(valueStr)).then((res)=> {
            if (res) {
              deferred.resolve()
            } else {
              deferred.reject()
            }
          }).catch((err)=> {
            deferred.reject()
          })
          return deferred.handle
        }))
        const object = scope.manage(vm.newObject())
        vm.setProp(object, 'put', putFn)

        const result = scope.manage(vm.unwrapResult(vm.callFunction(main, vm.global, object, scope.manage(vm.newString(data)))))
        vm.executePendingJobs()
      })



      // const handle = this.scope.manage(this.vm.getProp(this.vm.global, "main"))
      // const str = this.scope.manage(this.vm.newString('test'))
      // const result = this.scope.manage(this.vm?.unwrapResult(this.vm.callFunction(handle, this.vm.global, str)))
      // console.log('result: ', this.vm.getString(result))
    }

    dispose() {
      this.scope.dispose()
    }

    private interruptHandler():boolean {
      return false
    }




}

getQuickJS().then(QuickJS => {
  const result = QuickJS.evalCode('1 + 1', {
    shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + 1000),
    memoryLimitBytes: 1024 * 1024,
  })
  console.log(result)
})