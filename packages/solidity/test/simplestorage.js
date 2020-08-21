const SimpleStorage = artifacts.require("./SimpleStorage.sol");
const assert = require('assert');

contract("SimpleStorage", accounts => {
    it("should log", async() => {
        const simpleStorageInstance = await SimpleStorage.deployed();

        const characterCount = 20
        let str = ""
        for (let i = 0; i < characterCount; i++) {
            str = `${str}-${i}-`
        }

        const transition = Buffer.from(str)

        // Set value of 89
        const res = await simpleStorageInstance.log(transition.slice(0, 32), transition, { from: accounts[0] });

        console.log(res)
        const hex = res.logs[0].args.transition

        assert.equal(transition.length, Buffer.from(hex.slice(2), 'hex').length)
    });
});