import 'mocha'
import { expect } from 'chai'
import { uploadBuffer, downloadFile } from './skynet'

describe('SkyNet', ()=> {
    it('sanity', async ()=> {
        const buf = Buffer.from('hihi')
        const resp = await uploadBuffer(buf)
        expect(resp).to.be.a('string')
        const download = await downloadFile(resp)
        expect(buf.toString()).to.equal(download.toString())
    })
})