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
assert.equal(initialState.series.length, 120);
assert.equal(initialState.candles.length, 120);
assert.equal(initialState.trades.length, 8);

const nextState = advanceMarketState(initialState);
assert.equal(nextState.series.length, initialState.series.length);
assert.equal(nextState.candles.length, initialState.candles.length);
assert.equal(nextState.trades.length, initialState.trades.length);
assert.notEqual(nextState.lastUpdated, initialState.lastUpdated);

const chartMeta = buildChartMeta(nextState.candles, 640, 320);
assert.equal(Array.isArray(chartMeta.candles), true);
assert.equal(chartMeta.candles.length, nextState.candles.length);

assert.match(formatPrice(nextState.price), /^\d{2,3},/);
assert.match(formatSignedPercent(nextState.changePercent), /^[+-]/);

console.log("Verification passed");
