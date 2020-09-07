pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC1155/ERC1155Burnable.sol";
import "@openzeppelin/contracts/payment/PullPayment.sol";

contract HeavenToken is ERC1155Burnable, PullPayment {
    mapping(bytes32 => bool) public offers;

    event OfferHandled(bytes32 indexed offer, address indexed to, uint256 amount);
    event Elevate(bytes32 indexed destination, address from, uint256 amount);

    uint256 public constant FWEI = 0;
    uint256 public constant MANA = 1;

    constructor() public ERC1155("https://theanonymousheaven.com") {
    }

    function deposit() payable public {
        _mint(msg.sender, FWEI, msg.value, "");
    }

    function elevate(uint256 amount, bytes32 destination) public {
        _burn(msg.sender, MANA, amount);
        emit Elevate(destination, msg.sender, amount);
    }

    function convertFWEIToEth(uint256 amount) public {
        _burn(msg.sender, FWEI, amount);
        _asyncTransfer(msg.sender, amount);
    }

    // TODO: this will eventually be a price oracle, for now it is 1:1
    function convertFWEIToMana(uint256 amount) public {
        _burn(msg.sender, FWEI, amount);
        _mint(msg.sender, MANA, amount, "");
    }

    function elevateEth(bytes32 destination) payable public {
        deposit();
        convertFWEIToMana(msg.value);
        elevate(msg.value, destination);
    }

    function handleOffer(bytes32 offer, address to, uint256 amount) public {
        require(!offers[offer], "the offer must not exist in the mapping");
        safeTransferFrom(msg.sender, to, FWEI, amount, "");
        offers[offer] = true;
        emit OfferHandled(offer, to, amount);
    }
}
