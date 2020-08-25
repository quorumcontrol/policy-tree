pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract HeavenToken is ERC1155 {
    mapping(bytes => bool) public offers;

    uint256 public constant MANA = 0;

    constructor() public ERC1155("https://theanonymousheaven.com") {
        _mint(msg.sender, MANA, 100000, "");
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        bytes32 offer = keccak256(data);

        require(!offers[offer], "the offer must not exist in the mapping");
        offers[offer] = true;
    }

}
