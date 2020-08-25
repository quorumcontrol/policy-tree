// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

contract PolicyTreeTransitions {
  event Transition(address indexed from, bytes32 indexed bloom, bytes transition);

  function log(bytes32 bloom, bytes memory transition) public {
    emit Transition(msg.sender, bloom, transition);
  }
}
