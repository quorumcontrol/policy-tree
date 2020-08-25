// SPDX-License-Identifier: MIT
pragma solidity >=0.4.21 <0.7.0;

contract SimpleStorage {
  event Transition(address indexed _from, bytes32 bloom, bytes transition);

  function log(bytes32 bloom, bytes memory transition) public {
    emit Transition(msg.sender, bloom, transition);
  }
}
