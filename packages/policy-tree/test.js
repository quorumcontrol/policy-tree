const dagCBOR = require('ipld-dag-cbor')
const fs = require('fs')


async function run() {
    const id = await dagCBOR.util.cid(Buffer.from('hi'))
    console.log(id, id.bytes)
}

run().then(() => {
    process.exit
})