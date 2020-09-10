// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

contract PolicyTreeTransitions {
  event Transition(address indexed from, bytes32 indexed bloom, bytes transition);

  function log(bytes32 bloom, bytes memory transition) public {
    emit Transition(msg.sender, bloom, transition);
  }

  function logMultiple(bytes32[] memory blooms, bytes[] memory transitions) public {
      for (uint i = 0; i < blooms.length; i++) {
        emit Transition(msg.sender, blooms[i], transitions[i]);
      }
  }

  function callDataOnly(bytes32 bloom, bytes memory) public {
    emit Transition(msg.sender, bloom, "");
  }

}
