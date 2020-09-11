#!/usr/bin/env bash

env TS_NODE_COMPILER_OPTIONS='{"resolveJsonModule": true, "esModuleInterop": true, "module": "commonjs" }' ts-node scripts/deploy.ts