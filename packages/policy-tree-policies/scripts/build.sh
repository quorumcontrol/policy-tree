#!/usr/bin/env bash

set -e

rm -rf ./lib
tsc
javascripts=`find ./lib -name *.js`

for filepath in $javascripts; do
    filename=`basename ${filepath} .js`
    dirname=`dirname ${filepath}`
    terser -c -m -o ${dirname}/${filename}.min.js -- ${filepath}
done