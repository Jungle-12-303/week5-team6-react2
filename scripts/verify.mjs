import assert from "node:assert/strict";

import {
  createElement,
  FunctionComponent,
  useEffect,
  useMemo,
  useState,
} from "../src/lib/runtime.js";
import {
  advanceMarketState,
  buildChartMeta,
  createInitialMarketState,
  formatPrice,
  formatSignedPercent,
} from "../src/app/market-data.js";

assert.equal(typeof createElement, "function");
assert.equal(typeof FunctionComponent, "function");
assert.equal(typeof useState, "function");
assert.equal(typeof useEffect, "function");
assert.equal(typeof useMemo, "function");

const vnode = createElement("div", { className: "box" }, "hello");
assert.equal(vnode.type, "div");
assert.equal(vnode.props.children.length, 1);

const initialState = createInitialMarketState();
assert.equal(initialState.isHydrating, true);
assert.equal(initialState.series.length, 0);
assert.equal(initialState.candles.length, 0);
assert.equal(initialState.trades.length, 0);

const nextState = advanceMarketState(initialState);
assert.equal(nextState.isHydrating, false);
assert.equal(nextState.series.length, 150);
assert.equal(nextState.candles.length, 150);
assert.equal(nextState.trades.length, 8);
assert.equal(nextState.price !== null, true);

const chartMeta = buildChartMeta(nextState.candles, 640, 320);
assert.equal(Array.isArray(chartMeta.candles), true);
assert.equal(chartMeta.candles.length, nextState.candles.length);

assert.match(formatPrice(nextState.price), /^\d{2,3},/);
assert.match(formatSignedPercent(nextState.changePercent), /^[+-]/);

console.log("Verification passed");
