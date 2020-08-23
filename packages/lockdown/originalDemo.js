import 'ses'

lockdown()

console.log(Object.isFrozen([].__proto__));

const c = new Compartment({
    print: harden(console.log),
});

c.evaluate(`
    print('Hello! Hello?');
`);