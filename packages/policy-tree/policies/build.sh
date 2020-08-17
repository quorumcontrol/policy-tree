#!/usr/bin/env bash

set -e -x

REGO_PATH=$1

REGO_NAME=$(basename -- "$1")

pushd $REGO_PATH

opa build -t wasm -e ${REGO_NAME}/mods ${REGO_NAME}.rego

mkdir bundle
tar -xzf bundle.tar.gz --directory bundle
mv bundle/policy.wasm ./${REGO_NAME}.wasm
rm -r bundle
rm bundle.tar.gz