export const stdContract = `
var TransitionTypes;
(function (TransitionTypes) {
    TransitionTypes[TransitionTypes["GENESIS"] = -1] = "GENESIS";
    TransitionTypes[TransitionTypes["SEND_TOKEN"] = 0] = "SEND_TOKEN";
    TransitionTypes[TransitionTypes["RECEIVE_TOKEN"] = 1] = "RECEIVE_TOKEN";
    TransitionTypes[TransitionTypes["SET_DATA"] = 2] = "SET_DATA";
    TransitionTypes[TransitionTypes["MINT_TOKEN"] = 3] = "MINT_TOKEN";
})(TransitionTypes || (TransitionTypes = {}));
const assertOwner = async (tree, trans) => {
    const { initialOwners } = await tree.getMeta("/genesis");
    const currentOwners = await tree.getData("/owners");
    const owners = (currentOwners || initialOwners);
    if (!owners.includes(trans.sender)) {
        log("invalid sender");
        return false;
    }
    return true;
};
const exp = {
    [TransitionTypes.GENESIS]: async (_tr, _tra, _u) => {
        return true;
    },
    [TransitionTypes.SET_DATA]: async (tree, transition) => {
        if (!(await assertOwner(tree, transition))) {
            return false;
        }
        for (let key of Object.keys(transition.metadata)) {
            tree.setData(key, transition.metadata[key]);
        }
        return true;
    },
    [TransitionTypes.SEND_TOKEN]: async (tree, transition) => {
        if (!(await assertOwner(tree, transition))) {
            return false;
        }
        const metadata = transition.metadata;
        return tree.sendToken(metadata.token, metadata.dest, BigNumber.from(metadata.amount), metadata.nonce);
    },
    [TransitionTypes.RECEIVE_TOKEN]: async (tree, transition, { getAsset }) => {
        if (!(await assertOwner(tree, transition))) {
            return false;
        }
        log("RECEIVE_TOKEN: ", tree.did, " nonce: ", transition.metadata.nonce);
        const metadata = transition.metadata;
        const otherTree = await getAsset(metadata.from);
        return tree.receiveToken(metadata.token, metadata.nonce, otherTree);
    },
    [TransitionTypes.MINT_TOKEN]: async (tree, transition) => {
        if (!(await assertOwner(tree, transition))) {
            return false;
        }
        const metadata = transition.metadata;
        return tree.mintToken(metadata.token, BigNumber.from(metadata.amount));
    },
};
module.exports = exp;
`