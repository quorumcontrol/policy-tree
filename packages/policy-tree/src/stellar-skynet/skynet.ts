import axios from 'axios'
import FormData from 'form-data'
import urljoin from 'url-join'

const defaultPortalUrl = "https://siasky.net";

const uriSkynetPrefix = "sia://";

function defaultOptions(endpointPath: string) {
    return {
        portalUrl: defaultPortalUrl,
        endpointPath: endpointPath,
    };
}

function trimSiaPrefix(str: string) {
    return str.replace(uriSkynetPrefix, "");
}

/**
 * Properly joins paths together to create a URL.
 */
function makeUrl(...args: string[]) {
    return args.reduce(function (acc, cur) {
        return urljoin(acc, cur);
    });
}

const defaultUploadOptions = {
    ...defaultOptions("/skynet/skyfile"),
    portalFileFieldname: "file",
    customFilename: "",
    dryRun: false,
};

const defaultDownloadOptions = {
    ...defaultOptions("/"),
};

export function downloadFile(skylink: string, customOptions = {}) {
    const opts = { ...defaultDownloadOptions, ...customOptions };

    skylink = trimSiaPrefix(skylink);
    let url = makeUrl(opts.portalUrl, opts.endpointPath, skylink);

    return axios.get(url, { responseType: "arraybuffer" }).then((resp)=> {
        return Buffer.from(resp.data)
    })
}

export function uploadBuffer(buf: Buffer, customOptions = {}):Promise<string> {
    if (!Buffer.isBuffer(buf)) {
        buf = Buffer.from(buf)
    }
    const opts = { ...defaultUploadOptions, ...customOptions };

    const formData = new FormData();
    const options = {
        filename: opts.customFilename ? opts.customFilename : undefined,
        filepath: 'file.cbor',
        contentType: 'application/cbor',
    }

    let toUpload:Buffer|Blob = buf

    const isBrowser = (typeof Blob !== 'undefined')

    if (isBrowser) {
        toUpload = new Blob([buf])
    }
    formData.append(opts.portalFileFieldname, toUpload, options);

    // Form the URL.
    const url = makeUrl(opts.portalUrl, opts.endpointPath);
    const params: { dryrun?: boolean } = {};
    if (opts.dryRun) params.dryrun = true;

    const headers = isBrowser ? undefined : formData.getHeaders()

    return new Promise((resolve, reject) => {
        axios
            .post(url, formData, { params: params, headers: headers })
            .then((response) => {
                resolve(`${uriSkynetPrefix}${response.data.skylink}`);
            })
            .catch((error) => {
                reject(error);
            });
    });
}