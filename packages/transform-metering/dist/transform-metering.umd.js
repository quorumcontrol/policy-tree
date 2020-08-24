(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.TransformMetering = {}));
}(this, (function (exports) { 'use strict';

    // These are the meter members of the meterId.
    const METER_ALLOCATE = 'a';
    const METER_COMPUTE = 'c';
    const METER_ENTER = 'e';
    const METER_LEAVE = 'l';

    // These are the meter members of the meterId.
    const METER_COMBINED = '*';

    const DEFAULT_METER_ID = '$h\u200d_meter';
    const DEFAULT_SET_METER_ID = '$h\u200d_meter_set';
    const DEFAULT_REGEXP_ID_PREFIX = '$h\u200d_re_';

    // Default metering values.  These can easily be overridden in meter.js.
    // true means to use the combined meter.
    // undefined means not to meter.
    const DEFAULT_COMBINED_METER = 1e7;
    const DEFAULT_ALLOCATE_METER = true;
    const DEFAULT_COMPUTE_METER = true;
    const DEFAULT_STACK_METER = 8000;

    var c = /*#__PURE__*/Object.freeze({
        __proto__: null,
        METER_COMBINED: METER_COMBINED,
        DEFAULT_METER_ID: DEFAULT_METER_ID,
        DEFAULT_SET_METER_ID: DEFAULT_SET_METER_ID,
        DEFAULT_REGEXP_ID_PREFIX: DEFAULT_REGEXP_ID_PREFIX,
        DEFAULT_COMBINED_METER: DEFAULT_COMBINED_METER,
        DEFAULT_ALLOCATE_METER: DEFAULT_ALLOCATE_METER,
        DEFAULT_COMPUTE_METER: DEFAULT_COMPUTE_METER,
        DEFAULT_STACK_METER: DEFAULT_STACK_METER,
        METER_ALLOCATE: METER_ALLOCATE,
        METER_COMPUTE: METER_COMPUTE,
        METER_ENTER: METER_ENTER,
        METER_LEAVE: METER_LEAVE
    });

    const METER_GENERATED = Symbol('meter-generated');
    const getMeterId = 'getMeter';

    function makeMeteringTransformer(
        babelCore, {
            overrideParser = undefined,
            overrideRegExp = RegExp, // by default DO NOT override regexp, in the browser RE2 is not supported
            overrideMeterId = DEFAULT_METER_ID,
            overrideSetMeterId = DEFAULT_SET_METER_ID,
            overrideRegExpIdPrefix = DEFAULT_REGEXP_ID_PREFIX,
        } = {},
    ) {
        const parser = overrideParser ?
            overrideParser.parse || overrideParser :
            babelCore.parseSync;
        const meterId = overrideMeterId;
        const replaceGlobalMeterId = overrideSetMeterId;
        const regexpIdPrefix = overrideRegExpIdPrefix;
        let regexpNumber = 0;

        const meteringPlugin = regexpList => ({ types: t }) => {
            // const [[meterId]] = [[getMeterId]]();
            const getMeterDecl = () => {
                const emid = t.Identifier(getMeterId);
                const mid = t.Identifier(meterId);
                emid[METER_GENERATED] = true;
                mid[METER_GENERATED] = true;
                return t.variableDeclaration('const', [
                    t.variableDeclarator(mid, t.CallExpression(emid, [])),
                ]);
            };

            // [[meterId]] && [[meterId]][idString](...args)
            const meterCall = (idString, args = []) => {
                const mid = t.Identifier(meterId);
                mid[METER_GENERATED] = true;

                return t.logicalExpression(
                    '&&',
                    mid,
                    t.CallExpression(t.MemberExpression(mid, t.Identifier(idString)), args),
                );
            };

            // Wrap expr with `{ return expr; }` if necessary.
            const blockify = (exprOrBlock, doReturn = false) => {
                switch (exprOrBlock.type) {
                    case 'BlockStatement':
                        {
                            const { body, directives } = exprOrBlock;
                            return t.blockStatement([...body], directives);
                        }
                    case 'EmptyStatement':
                        return t.BlockStatement([]);
                    default:
                        if (!doReturn) {
                            return t.BlockStatement([exprOrBlock]);
                        }
                        if (exprOrBlock.type === 'ExpressionStatement') {
                            return t.BlockStatement([
                                t.ReturnStatement(exprOrBlock.expression),
                            ]);
                        }
                        return t.BlockStatement([t.ReturnStatement(exprOrBlock)]);
                }
            };

            // Transform a body into a stack-metered try...finally block.
            const wrapWithStackMeter = tryBlock => {
                const finalizer = t.BlockStatement([
                    t.ExpressionStatement(meterCall(METER_LEAVE)),
                ]);
                finalizer[METER_GENERATED] = true;
                const newBlock = t.BlockStatement([
                    getMeterDecl(),
                    t.ExpressionStatement(meterCall(METER_ENTER)),
                    t.TryStatement(tryBlock, null, finalizer),
                ]);
                return newBlock;
            };

            // Transform a body into a compute-metered block.
            const wrapWithComputeMeter = block => {
                block.body.unshift(t.ExpressionStatement(meterCall(METER_COMPUTE)));
                return block;
            };

            const visitor = {
                // Ensure meter identifiers are generated by us, or abort.
                Identifier(path) {
                    if (
                        (path.node.name === meterId ||
                            path.node.name === getMeterId ||
                            path.node.name === replaceGlobalMeterId ||
                            path.node.name.startsWith(regexpIdPrefix)) &&
                        !path.node[METER_GENERATED]
                    ) {
                        throw path.buildCodeFrameError(
                            `Identifier ${path.node.name} is reserved for metering code`,
                        );
                    }
                },
                RegExpLiteral(path) {
                    const { pattern, flags } = path.node;
                    const reid = `${regexpIdPrefix}${regexpNumber}`;
                    regexpNumber += 1;
                    regexpList.push(`\
const ${reid}=RegExp(${JSON.stringify(pattern)},${JSON.stringify(flags)});`);
                    const reNode = t.identifier(reid);
                    reNode[METER_GENERATED] = true;
                    path.replaceWith(reNode);
                },
                // Loop constructs need only a compute meter.
                DoWhileStatement(path) {
                    path.node.body = wrapWithComputeMeter(blockify(path.node.body));
                },
                ForStatement(path) {
                    path.node.body = wrapWithComputeMeter(blockify(path.node.body));
                },
                ForOfStatement(path) {
                    path.node.body = wrapWithComputeMeter(blockify(path.node.body));
                },
                ForInStatement(path) {
                    path.node.body = wrapWithComputeMeter(blockify(path.node.body));
                },
                WhileStatement(path) {
                    path.node.body = wrapWithComputeMeter(blockify(path.node.body));
                },
                // To prevent interception after exhaustion, wrap catch and finally.
                CatchClause(path) {
                    path.node.body = wrapWithComputeMeter(path.node.body);
                },
                TryStatement(path) {
                    if (path.node.handler && !t.isCatchClause(path.node.handler)) {
                        path.node.handler = wrapWithComputeMeter(path.node.handler);
                    }
                    if (path.node.finalizer && !path.node.finalizer[METER_GENERATED]) {
                        path.node.finalizer = wrapWithComputeMeter(path.node.finalizer);
                    }
                },
                // Function definitions need a stack meter, too.
                ArrowFunctionExpression(path) {
                    path.node.body = wrapWithStackMeter(blockify(path.node.body, true));
                },
                ClassMethod(path) {
                    path.node.body = wrapWithStackMeter(path.node.body);
                },
                FunctionExpression(path) {
                    path.node.body = wrapWithStackMeter(path.node.body);
                },
                FunctionDeclaration(path) {
                    path.node.body = wrapWithStackMeter(path.node.body);
                },
                ObjectMethod(path) {
                    path.node.body = wrapWithStackMeter(path.node.body);
                },
            };
            return { visitor };
        };

        const meteringTransform = {
            rewrite(ss) {
                const { src: source, endowments } = ss;

                if (!endowments[getMeterId]) {
                    // This flag turns on the metering.
                    return ss;
                }

                // Bill the sources to the meter we'll use later.
                const meter = endowments[getMeterId](true);
                // console.log('got meter from endowments', meter);
                meter && meter[METER_COMPUTE](source.length);

                // Do the actual transform.
                const ast = parser(source);
                const regexpList = [];
                const output = babelCore.transformFromAstSync(ast, source, {
                    generatorOpts: {
                        retainLines: true,
                    },
                    plugins: [meteringPlugin(regexpList)],
                    ast: true,
                    code: true,
                });

                // Meter by the regular expressions in use.
                const regexpSource = regexpList.join('');
                const preSource = `const ${meterId}=${getMeterId}();\
${meterId}&&${meterId}.${METER_ENTER}();\
try{${regexpSource}`;
                const postSource = `\n}finally{${meterId} && ${meterId}.${METER_LEAVE}();}`;

                // Force into an IIFE, if necessary.
                const maybeSource = output.code;
                const actualSource =
                    ss.sourceType === 'expression' ?
                    `(function(){${preSource}return ${maybeSource}${postSource}})()` :
                    `${preSource}${maybeSource}${postSource}`;

                if (overrideRegExp) {
                    // By default, override with RE2, which protects against
                    // catastrophic backtracking.
                    endowments.RegExp = overrideRegExp;
                }

                // console.log('metered source:', `\n${actualSource}`);

                return {
                    ...ss,
                    ast,
                    endowments,
                    src: actualSource,
                };
            },
        };

        return meteringTransform;
    }

    function makeMeteredEvaluator({
      replaceGlobalMeter,
      refillMeterInNewTurn,
      makeEvaluator,
      babelCore,
      quiesceCallback = cb => cb(),
    }) {
      const meteringTransform = makeMeteringTransformer(babelCore);
      const transforms = [meteringTransform];

      const ev = makeEvaluator({ transforms });
      const metersSeenThisTurn = new Set();

      const syncEval = (
        meter,
        srcOrThunk,
        endowments = {},
        whenQuiesced = undefined,
      ) => {
        let returned;
        let exceptionBox = false;

        // Enable the specific meter.
        const savedMeter = replaceGlobalMeter(null);
        try {
          if (whenQuiesced) {
            // Install the quiescence callback.
            quiesceCallback(() => {
              // console.log('quiescer exited');
              replaceGlobalMeter(savedMeter);
              // Declare that we're done the meter
              const seenMeters = [...metersSeenThisTurn.keys()];
              metersSeenThisTurn.clear();
              if (exceptionBox) {
                whenQuiesced([false, exceptionBox[0], seenMeters]);
              } else {
                whenQuiesced([true, returned, seenMeters]);
              }
            });
          }

          if (typeof srcOrThunk === 'string') {
            // Transform the source on our own budget, then evaluate against the meter.
            endowments.getMeter = m => {
              if (refillMeterInNewTurn && !metersSeenThisTurn.has(meter)) {
                metersSeenThisTurn.add(meter);
                refillMeterInNewTurn(meter);
              }
              if (m !== true) {
                replaceGlobalMeter(meter);
              }
              return meter;
            };
            returned = ev.evaluate(srcOrThunk, endowments);
          } else {
            // Evaluate the thunk with the specified meter.
            if (refillMeterInNewTurn && !metersSeenThisTurn.has(meter)) {
              metersSeenThisTurn.add(meter);
              refillMeterInNewTurn(meter);
            }
            replaceGlobalMeter(meter);
            returned = srcOrThunk();
          }
        } catch (e) {
          exceptionBox = [e];
        }
        try {
          replaceGlobalMeter(savedMeter);
          const seenMeters = [...metersSeenThisTurn.keys()];
          if (exceptionBox) {
            return [false, exceptionBox, seenMeters];
          }
          return [true, returned, seenMeters];
        } finally {
          if (whenQuiesced) {
            // Keep going with the specified meter while we're quiescing.
            replaceGlobalMeter(meter);
          }
        }
      };

      if (quiesceCallback) {
        const quiescingEval = (meter, srcOrThunk, endowments = {}) => {
          let whenQuiesced;
          const whenQuiescedP = new Promise(res => (whenQuiesced = res));

          // Defer the evaluation for another turn.
          Promise.resolve().then(_ =>
            syncEval(meter, srcOrThunk, endowments, whenQuiesced),
          );
          return whenQuiescedP;
        };
        return quiescingEval;
      }

      return syncEval;
    }

    /* global BigInt */

    const { isArray } = Array;
    const { getOwnPropertyDescriptors } = Object;
    const { ceil } = Math;
    const ObjectConstructor = Object;

    // eslint-disable-next-line no-bitwise
    const bigIntWord = typeof BigInt !== 'undefined' && BigInt(1 << 32);
    const bigIntZero = bigIntWord && BigInt(0);

    // Stop deducting when we reach a negative number.
    const makeCounter = initBalance => {
      let balance = initBalance;
      const counter = (increment, alwaysDecrement = true) => {
        if (balance <= 0 && !alwaysDecrement) {
          return 1;
        }
        if (balance > 0) {
          balance += increment;
        }
        return balance;
      };
      counter.reset = (newBalance = undefined) =>
        (balance = newBalance === undefined ? initBalance : newBalance);
      counter.getBalance = () => balance;
      return counter;
    };

    function makeAborter() {
      let abortReason;
      const maybeAbort = (reason = undefined, throwForever = true) => {
        if (reason !== undefined) {
          // Set a new reason.
          abortReason = reason;
        }
        if (abortReason !== undefined && throwForever) {
          // Keep throwing the same reason.
          throw abortReason;
        }
        return abortReason;
      };
      maybeAbort.reset = () => (abortReason = undefined);
      return maybeAbort;
    }

    function makeComputeMeter(maybeAbort, meter, computeCounter = null) {
      if (computeCounter === null) {
        return (_cost = 1, throwForever = true) => {
          maybeAbort(undefined, throwForever);
        };
      }
      return (cost = 1, throwForever = true) => {
        maybeAbort(undefined, throwForever);
        if (computeCounter(-cost, throwForever) <= 0) {
          throw maybeAbort(RangeError(`Compute meter exceeded`), throwForever);
        }
      };
    }

    function makeAllocateMeter(maybeAbort, meter, allocateCounter = null) {
      if (allocateCounter === null) {
        return (value, throwForever = true) => {
          maybeAbort(undefined, throwForever);
          return value;
        };
      }
      return (value, throwForever = true) => {
        maybeAbort(undefined, throwForever);
        try {
          // meter[c.METER_ENTER](undefined, throwForever);
          let cost = 1;
          if (value && ObjectConstructor(value) === value) {
            // Either an array or an object with properties.
            if (isArray(value)) {
              // The size of the array.  This property cannot be overridden.
              cost += value.length;
            } else {
              // Compute the number of own properties.
              // eslint-disable-next-line guard-for-in, no-unused-vars
              for (const p in getOwnPropertyDescriptors(value)) {
                meter[METER_COMPUTE](undefined, throwForever);
                cost += 1;
              }
            }
          } else {
            // We have a primitive.
            const t = typeof value;
            switch (t) {
              case 'string':
                // The size of the string, in approximate words.
                cost += ceil(value.length / 4);
                break;
              case 'bigint': {
                // Compute the number of words in the bigint.
                let remaining = value;
                if (remaining < bigIntZero) {
                  remaining = -remaining;
                }
                while (remaining > bigIntZero) {
                  meter[METER_COMPUTE](undefined, throwForever);
                  remaining /= bigIntWord;
                  cost += 1;
                }
                break;
              }
              case 'object':
                if (value !== null) {
                  throw maybeAbort(
                    TypeError(`Allocate meter found unexpected non-null object`),
                    throwForever,
                  );
                }
                // Otherwise, minimum cost.
                break;
              case 'boolean':
              case 'undefined':
              case 'number':
              case 'symbol':
                // Minimum cost.
                break;
              default:
                throw maybeAbort(
                  TypeError(`Allocate meter found unrecognized type ${t}`),
                  throwForever,
                );
            }
          }

          if (allocateCounter(-cost, throwForever) <= 0) {
            throw maybeAbort(RangeError(`Allocate meter exceeded`), throwForever);
          }
          return value;
        } finally {
          // meter[c.METER_LEAVE](undefined, throwForever);
        }
      };
    }

    function makeStackMeter(maybeAbort, meter, stackCounter = null) {
      if (stackCounter === null) {
        return (_cost, throwForever = true) => {
          maybeAbort(undefined, throwForever);
        };
      }
      return (cost = 1, throwForever = true) => {
        try {
          meter[METER_COMPUTE](undefined, throwForever);
          maybeAbort(undefined, throwForever);
          if (stackCounter(-cost, throwForever) <= 0) {
            throw maybeAbort(RangeError(`Stack meter exceeded`), throwForever);
          }
        } catch (e) {
          throw maybeAbort(e, throwForever);
        }
      };
    }

    function makeMeter(budgets = {}) {
      let combinedCounter;
      const counter = (vname, dflt) => {
        const budget = vname in budgets ? budgets[vname] : c[dflt];
        if (budget === true) {
          if (!combinedCounter) {
            throw TypeError(
              `A budgetCombined value must be set to use the combined meter for ${vname}`,
            );
          }
          return combinedCounter;
        }
        return budget === null ? null : makeCounter(budget);
      };

      combinedCounter = counter('budgetCombined', 'DEFAULT_COMBINED_METER');
      const allocateCounter = counter('budgetAllocate', 'DEFAULT_ALLOCATE_METER');
      const computeCounter = counter('budgetCompute', 'DEFAULT_COMPUTE_METER');
      const stackCounter = counter('budgetStack', 'DEFAULT_STACK_METER');

      // Link all the meters together with the same aborter.
      const maybeAbort = makeAborter();
      const meter = {};
      // The stack meter has no other dependencies.
      const meterStack = makeStackMeter(maybeAbort, meter, stackCounter);
      // The compute meter only needs the stack meter.
      const meterCompute = makeComputeMeter(maybeAbort, meter, computeCounter);
      // Allocate meters need both stack and compute meters.
      const meterAllocate = makeAllocateMeter(maybeAbort, meter, allocateCounter);

      const makeResetter = cnt => (newBalance = undefined) => {
        maybeAbort.reset();
        if (cnt) {
          cnt.reset(newBalance);
        }
      };
      const isExhausted = () => {
        return maybeAbort(undefined, false);
      };

      const refillFacet = {
        isExhausted,
        allocate: makeResetter(allocateCounter),
        stack: makeResetter(stackCounter),
        compute: makeResetter(computeCounter),
        combined: makeResetter(combinedCounter),
        getAllocateBalance: allocateCounter.getBalance,
        getComputeBalance: computeCounter.getBalance,
        getCombinedBalance: combinedCounter.getBalance,
      };

      // Create the internal meter object.
      meter[METER_ALLOCATE] = meterAllocate;
      meter[METER_COMPUTE] = meterCompute;
      meter[METER_ENTER] = meterStack;
      meter[METER_LEAVE] = () => meterStack(-1);
      meter.isExhausted = isExhausted;

      // Export the allocate meter with other meters as properties.
      Object.assign(meterAllocate, meter);
      return {
        meter: meterAllocate,
        refillFacet,
      };
    }

    function makeWithMeter(replaceGlobalMeter, defaultMeter = null) {
      const withMeter = (thunk, newMeter = defaultMeter) => {
        let oldMeter;
        try {
          oldMeter = replaceGlobalMeter(newMeter);
          return thunk();
        } finally {
          replaceGlobalMeter(oldMeter);
        }
      };
      const withoutMeter = thunk => withMeter(thunk, null);
      return { withMeter, withoutMeter };
    }

    exports.makeMeter = makeMeter;
    exports.makeMeteredEvaluator = makeMeteredEvaluator;
    exports.makeMeteringTransformer = makeMeteringTransformer;
    exports.makeWithMeter = makeWithMeter;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
