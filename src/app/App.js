import { createElement as h, useEffect, useMemo, useState } from "../lib/runtime.js";
import {
  advanceMarketState,
  applyLivePriceUpdate,
  applyLiveTradeUpdate,
  applyLiveKlineUpdate,
  buildChartMeta,
  buildChartStateFromKlines,
  buildMarketStateFromAggTrades,
  createInitialChartState,
  createInitialMarketState,
  formatAmount,
  formatAxisTick,
  formatClock,
  formatCompactNumber,
  formatPrice,
  getChartIntervalLabel,
  formatSignedPercent,
  formatSignedPrice,
  setMarketConnection,
} from "./market-data.js";
import {
  connectBinanceFeed,
  connectBinanceKlineFeed,
  fetchRecentAggTrades,
  fetchRecentKlines,
} from "./binance-feed.js";

/**
 * Header는 페이지 최상단 소개 영역을 렌더링한다.
 *
 * props:
 * - market: 현재 루트 state 전체 객체
 *
 * 이 컴포넌트는 hook을 사용하지 않고, 부모가 내려준 값만 그대로 읽는다.
 */
function Header({ market }) {
  const feedStatusLabel = market.feedMode === "live" ? "Live WebSocket" : market.feedMode === "mock" ? "Mock Data" : "Loading";
  const feedStatusClass = market.feedMode === "live" ? "positive" : market.feedMode === "mock" ? "negative" : "";

  return h(
    "section",
    { className: "hero" },
    h(
      "div",
      { className: "hero-copy" },
      h("span", { className: "eyebrow" }, "Custom Runtime Only"),
      h("h1", null, "Bitcoin Live Board"),
    ),
    h(
      "div",
      { className: "hero-meta" },
      h("span", { className: `meta-chip ${feedStatusClass}` }, `${feedStatusLabel}: ${market.connectionLabel}`),
    ),
  );
}

/**
 * PricePanel은 현재가, 등락률, 세션 고가/저가, 누적 볼륨을 보여준다.
 *
 * 이 컴포넌트도 stateless component다.
 * 즉 "데이터를 계산해서 보관"하지 않고, 전달받은 market을 화면에만 표시한다.
 */
function PricePanel({ market }) {
  const isLoading = market.isHydrating;
  const trendClass = market.change >= 0 ? "positive" : "negative";
  const priceText = isLoading || market.price === null ? "Loading..." : formatPrice(market.price);
  const changeText = isLoading ? "" : formatSignedPercent(market.changePercent);
  const noteText = isLoading ? "최근 Binance 거래를 불러오는 중입니다." : `Tick delta ${formatSignedPrice(market.change)} · Updated ${formatClock(market.lastUpdated)}`;
  const highText = isLoading || market.stats.high === null ? "—" : formatPrice(market.stats.high);
  const lowText = isLoading || market.stats.low === null ? "—" : formatPrice(market.stats.low);
  const volumeBtcText = isLoading ? "—" : formatAmount(market.stats.volumeBtc);
  const volumeUsdtText = isLoading ? "—" : formatCompactNumber(market.stats.volumeUsdt);

  return h(
    "section",
    { className: "panel price-panel" },
    h(
      "div",
      { className: "panel-header" },
      h(
        "div",
        null,
        h("h2", { className: "panel-title" }, `${market.symbol} Perpetual`),
        h("p", { className: "panel-subtitle" }, "루트 state에서만 가격 데이터를 관리하고, 모든 자식 UI는 props만 받습니다."),
      ),
    ),
    h(
      "div",
      { className: "price-grid" },
      h(
        "article",
        { className: "price-card" },
        h("div", { className: "price-label" }, "Last Price (USDT)"),
        h(
          "div",
          { className: "price-value" },
          h("span", { className: `price-number ${isLoading ? "" : trendClass}` }, priceText),
          changeText ? h("span", { className: `price-delta ${trendClass}` }, changeText) : null,
        ),
        h("div", { className: "price-note" }, noteText),
      ),
      h(
        "div",
        { className: "stats-grid" },
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Session High"), h("div", { className: "stat-value" }, highText)),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Session Low"), h("div", { className: "stat-value" }, lowText)),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Feed Volume (BTC)"), h("div", { className: "stat-value" }, volumeBtcText)),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Feed Volume (USDT)"), h("div", { className: "stat-value" }, volumeUsdtText)),
      ),
    ),
  );
}

/**
 * ChartPanel은 이미 계산이 끝난 chartMeta를 받아 1초 캔들 차트를 SVG로 그린다.
 *
 * 핵심 포인트:
 * - 실제 데이터 가공은 market-data.js에서 끝난 상태다.
 * - 이 컴포넌트는 "좌표를 해석해서 SVG 요소를 만든다"는 역할만 한다.
 */
function ChartPanel({
  chartState,
  selectedInterval,
  onSelectInterval,
  movingAverageInput,
  appliedMovingAveragePeriod,
  onMovingAverageInputChange,
  onApplyMovingAverage,
  chartMeta,
}) {
  const isLoading = chartState.isLoading && chartState.candles.length === 0;
  const isValidMovingAverageInput = /^\d+$/.test(movingAverageInput) && Number(movingAverageInput) >= 5 && Number(movingAverageInput) <= 20;

  return h(
    "section",
    { className: "panel chart-panel" },
    h(
      "div",
      { className: "panel-header" },
      h("div", null, h("h2", { className: "panel-title" }, `BTCUSDT ${getChartIntervalLabel(selectedInterval)} Chart`)),
      h(
        "div",
        { className: "interval-toggle" },
        ["1s", "1m", "5m"].map((interval) =>
          h(
            "button",
            {
              key: interval,
              type: "button",
              className: `interval-button ${selectedInterval === interval ? "active" : ""}`,
              onClick: () => onSelectInterval(interval),
            },
            getChartIntervalLabel(interval),
          ),
        ),
      ),
    ),
    h(
      "div",
      { className: "chart-frame" },
      h(
        "div",
        { className: "ma-controls" },
        h("label", { className: "ma-label", for: `ma-input-${selectedInterval}` }, `${getChartIntervalLabel(selectedInterval)} MA`),
        h("input", {
          id: `ma-input-${selectedInterval}`,
          className: "ma-input",
          type: "number",
          min: "5",
          max: "20",
          step: "1",
          value: movingAverageInput,
          placeholder: "5-20",
          onInput: (event) => onMovingAverageInputChange(event.target.value),
        }),
        h(
          "button",
          {
            type: "button",
            className: `ma-apply-button ${isValidMovingAverageInput ? "active" : ""}`,
            onClick: () => onApplyMovingAverage(),
            disabled: !isValidMovingAverageInput,
          },
          "Apply",
        ),
        h("span", { className: "ma-status" }, appliedMovingAveragePeriod ? `Active MA(${appliedMovingAveragePeriod})` : "No MA"),
      ),
      isLoading
        ? h(
            "div",
            { className: "chart-loading" },
            h("div", { className: "chart-loading-title" }, "Loading chart"),
            h("div", { className: "chart-loading-copy" }, selectedInterval === "1s" ? "1초 차트 데이터를 준비하는 중입니다." : `${getChartIntervalLabel(selectedInterval)} Binance kline 데이터를 불러오는 중입니다.`),
          )
        : h(
            "svg",
            { className: "chart-canvas", viewBox: "0 0 640 320", preserveAspectRatio: "none" },
            chartMeta.movingAverage.length
              ? h("polyline", {
                  points: chartMeta.movingAverage.map((point) => `${point.x},${point.y}`).join(" "),
                  fill: "none",
                  stroke: "rgba(167, 139, 250, 0.95)",
                  strokeWidth: "1.8",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                })
              : null,
            h("line", {
              x1: String(chartMeta.plotWidth),
              x2: String(chartMeta.plotWidth),
              y1: "0",
              y2: "320",
              stroke: "rgba(149, 163, 194, 0.24)",
              strokeWidth: "1",
            }),
            chartMeta.axisTicks.map((tick) => [
              h("line", {
                key: `tick-line-${tick.key}`,
                x1: String(chartMeta.plotWidth),
                x2: "640",
                y1: String(tick.y),
                y2: String(tick.y),
                stroke: "rgba(149, 163, 194, 0.14)",
                strokeWidth: "1",
              }),
              h(
                "text",
                {
                  key: `tick-label-${tick.key}`,
                  x: String(chartMeta.plotWidth + 42),
                  y: String(tick.y),
                  fill: "rgba(237, 243, 255, 0.82)",
                  "font-size": "11",
                  "text-anchor": "end",
                  "dominant-baseline": "middle",
                },
                formatAxisTick(tick.value, chartMeta.axisStep),
              ),
            ]),
            chartMeta.candles.map((candle) => [
              h("line", {
                key: `wick-${candle.key}`,
                x1: String(candle.centerX),
                x2: String(candle.centerX),
                y1: String(candle.highY),
                y2: String(candle.lowY),
                stroke: candle.color,
                strokeWidth: "1.5",
                strokeLinecap: "round",
              }),
              h("rect", {
                key: `body-${candle.key}`,
                x: String(candle.bodyX),
                y: String(candle.bodyY),
                width: String(candle.bodyWidth),
                height: String(candle.bodyHeight),
                rx: "1.5",
                fill: candle.rising ? "rgba(45, 212, 191, 0.88)" : "rgba(251, 113, 133, 0.88)",
                stroke: candle.color,
                strokeWidth: "1",
              }),
            ]),
          ),
    ),
  );
}

/**
 * TradesPanel은 최근 체결 내역을 표 형태로 보여준다.
 *
 * 표시는 최신 체결이 위로 오게 reverse 순서를 사용한다.
 */
function TradesPanel({ trades, feedMode }) {
  const rows = [...trades].reverse();

  return h(
    "aside",
    { className: "panel trades-panel" },
    h(
      "div",
      { className: "panel-header" },
      h(
        "div",
        null,
        h("h2", { className: "panel-title" }, "Contract History"),
        h("p", { className: "panel-subtitle" }, `${feedMode === "live" ? "Binance aggTrade" : "Mock trades"} 기준으로 가장 최근 체결이 위에 표시됩니다.`),
      ),
    ),
    h(
      "div",
      { className: "trade-list" },
      rows.length === 0
        ? h("div", { className: "trade-empty" }, "최근 체결 데이터를 불러오는 중입니다.")
        : h(
            "table",
            { className: "trade-table" },
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                h("th", null, "Time"),
                h("th", null, "Side"),
                h("th", null, "Price"),
                h("th", null, "Amount"),
              ),
            ),
            h(
              "tbody",
              null,
              rows.map((trade) =>
                h(
                  "tr",
                  { key: trade.id },
                  h("td", null, trade.time),
                  h("td", { className: `trade-side ${trade.side === "BUY" ? "trade-buy" : "trade-sell"}` }, trade.side),
                  h("td", null, formatPrice(trade.price)),
                  h("td", null, `${formatAmount(trade.amount)} BTC`),
                ),
              ),
            ),
          ),
    ),
  );
}

/**
 * App은 이 프로젝트의 루트 컴포넌트다.
 *
 * 실행 순서 1:
 * main.js가 mountRoot(App, container)를 호출하면 가장 먼저 이 컴포넌트가 실행된다.
 *
 * 중요한 규칙:
 * - hook은 여기, 즉 최상단 루트 컴포넌트에서만 사용한다.
 * - 아래 자식 컴포넌트들은 props만 받아서 렌더링한다.
 */
export function App() {
  // 실행 순서 2:
  // 앱이 처음 시작할 때 루트 market state를 만든다.
  const [market, setMarket] = useState(() => createInitialMarketState());
  const [selectedInterval, setSelectedInterval] = useState("1s");
  const [chartState, setChartState] = useState(() => createInitialChartState());
  const [movingAverageInputs, setMovingAverageInputs] = useState(() => ({
    "1s": "",
    "1m": "",
    "5m": "",
  }));
  const [appliedMovingAveragePeriods, setAppliedMovingAveragePeriods] = useState(() => ({
    "1s": null,
    "1m": null,
    "5m": null,
  }));

  // 실행 순서 5:
  // 최초 렌더 후 Binance WebSocket 연결 또는 mock fallback 타이머를 설정한다.
  useEffect(() => {
    let mockTimer = null;
    let disconnect = () => {};
    let disposed = false;
    let isBackfillReady = false;
    let bufferedPayloads = [];

    /**
     * mock 피드 interval을 안전하게 정리한다.
     */
    const stopMockFeed = () => {
      if (mockTimer) {
        window.clearInterval(mockTimer);
        mockTimer = null;
      }
    };

    /**
     * live 피드가 불가능한 경우 mock 피드를 시작한다.
     *
     * 실행 순서 5-1:
     * 연결 실패 -> 상태를 mock으로 표시 -> 1초마다 setMarket 호출
     */
    const startMockFeed = (reason) => {
      setMarket((previousState) => setMarketConnection(previousState, "mock", reason));
      if (mockTimer) {
        return;
      }

      mockTimer = window.setInterval(() => {
        setMarket((previousState) => advanceMarketState(previousState));
      }, 1000);
    };

    /**
     * 실행 순서 5-2:
     * Binance 피드에 연결하고, 상태 변화/실패/실시간 이벤트를 루트 state에 반영한다.
     */
    const openLiveFeed = () => {
      disconnect = connectBinanceFeed({
        symbol: "btcusdt",
        onStatusChange: (status) => {
          const labels = {
            connected: "Binance socket connected",
            connecting: "Connecting to Binance Futures",
            live: "Binance Futures live feed",
            reconnecting: "Reconnecting to Binance Futures",
          };

          setMarket((previousState) => setMarketConnection(previousState, status, labels[status] || "Binance feed status updated"));
        },
        onFallback: (reason) => {
          startMockFeed(reason);
        },
        onEvent: (payload) => {
          stopMockFeed();

          if (!isBackfillReady) {
            bufferedPayloads.push(payload);
            return;
          }

          // 실행 순서 6:
          // JSON payload를 받고, 어떤 이벤트인지에 따라 다음 state를 계산한다.
          setMarket((previousState) => {
            if (payload.e === "markPriceUpdate") {
              return applyLivePriceUpdate(previousState, payload);
            }

            if (payload.e === "aggTrade") {
              return applyLiveTradeUpdate(previousState, payload);
            }

            return previousState;
          });
        },
      });
    };

    const bootstrapLiveFeed = async () => {
      const requestStartedAt = Date.now();
      setMarket((previousState) => setMarketConnection(previousState, "connecting", "Loading recent Binance trades"));
      openLiveFeed();

      try {
        const trades = await fetchRecentAggTrades("btcusdt", requestStartedAt);

        if (disposed) {
          return;
        }

        if (trades.length > 0) {
          setMarket((previousState) => {
            let nextState = buildMarketStateFromAggTrades(previousState, trades, Date.now());

            bufferedPayloads.forEach((payload) => {
              if (payload.e === "markPriceUpdate") {
                nextState = applyLivePriceUpdate(nextState, payload);
              }

              if (payload.e === "aggTrade") {
                nextState = applyLiveTradeUpdate(nextState, payload);
              }
            });

            return nextState;
          });
        } else if (bufferedPayloads.length > 0) {
          setMarket((previousState) => {
            let nextState = previousState;

            bufferedPayloads.forEach((payload) => {
              if (payload.e === "markPriceUpdate") {
                nextState = applyLivePriceUpdate(nextState, payload);
              }

              if (payload.e === "aggTrade") {
                nextState = applyLiveTradeUpdate(nextState, payload);
              }
            });

            return nextState;
          });
        }
      } catch (error) {
        console.error("Failed to backfill recent Binance trades", error);

        if (!disposed && bufferedPayloads.length > 0) {
          setMarket((previousState) => {
            let nextState = previousState;

            bufferedPayloads.forEach((payload) => {
              if (payload.e === "markPriceUpdate") {
                nextState = applyLivePriceUpdate(nextState, payload);
              }

              if (payload.e === "aggTrade") {
                nextState = applyLiveTradeUpdate(nextState, payload);
              }
            });

            return nextState;
          });
        }
      }

      bufferedPayloads = [];
      isBackfillReady = true;
    };

    bootstrapLiveFeed();

    return () => {
      disposed = true;
      stopMockFeed();
      disconnect();
    };
  }, []);

  // 실행 순서 5-b:
  // 차트 interval이 바뀔 때마다 공식 Binance kline REST + WebSocket으로 차트 feed를 다시 연결한다.
  useEffect(() => {
    if (selectedInterval === "1s") {
      setChartState((previousState) => ({
        ...previousState,
        interval: "1s",
        candles: market.candles,
        connectionStatus: market.connectionStatus,
        connectionLabel: market.connectionLabel,
        isLoading: market.isHydrating && market.candles.length === 0,
      }));

      return () => {};
    }

    let disposed = false;
    let disconnectKline = () => {};
    let isHydrated = false;
    let bufferedKlines = [];

    setChartState((previousState) => ({
      ...previousState,
      interval: selectedInterval,
      candles: [],
      connectionStatus: "connecting",
      connectionLabel: `Loading Binance ${getChartIntervalLabel(selectedInterval)} kline data`,
      isLoading: true,
    }));

    const openKlineFeed = () => {
      disconnectKline = connectBinanceKlineFeed({
        symbol: "btcusdt",
        interval: selectedInterval,
        onStatusChange: (status) => {
          const labels = {
            connected: `Binance ${getChartIntervalLabel(selectedInterval)} kline connected`,
            connecting: `Connecting Binance ${getChartIntervalLabel(selectedInterval)} kline`,
            live: `Binance ${getChartIntervalLabel(selectedInterval)} kline live`,
            reconnecting: `Reconnecting Binance ${getChartIntervalLabel(selectedInterval)} kline`,
            error: `Binance ${getChartIntervalLabel(selectedInterval)} kline error`,
          };

          setChartState((previousState) => ({
            ...previousState,
            interval: selectedInterval,
            connectionStatus: status,
            connectionLabel: labels[status] || previousState.connectionLabel,
          }));
        },
        onEvent: (payload) => {
          if (!isHydrated) {
            bufferedKlines.push(payload);
            return;
          }

          setChartState((previousState) => applyLiveKlineUpdate(previousState, payload, selectedInterval));
        },
      });
    };

    const bootstrapKlines = async () => {
      openKlineFeed();

      try {
        const klines = await fetchRecentKlines("btcusdt", selectedInterval, 120);

        if (disposed) {
          return;
        }

        setChartState((previousState) => {
          let nextState = buildChartStateFromKlines(previousState, klines, selectedInterval);

          bufferedKlines.forEach((payload) => {
            nextState = applyLiveKlineUpdate(nextState, payload, selectedInterval);
          });

          return nextState;
        });
      } catch (error) {
        console.error("Failed to fetch recent Binance klines", error);

        if (!disposed && bufferedKlines.length > 0) {
          setChartState((previousState) => {
            let nextState = {
              ...previousState,
              interval: selectedInterval,
              candles: [],
              connectionStatus: "live",
              connectionLabel: `Binance ${getChartIntervalLabel(selectedInterval)} kline live`,
              isLoading: false,
            };

            bufferedKlines.forEach((payload) => {
              nextState = applyLiveKlineUpdate(nextState, payload, selectedInterval);
            });

            return nextState;
          });
        }
      }

      bufferedKlines = [];
      isHydrated = true;
    };

    bootstrapKlines();

    return () => {
      disposed = true;
      disconnectKline();
    };
  }, [selectedInterval]);

  // 실행 순서 3:
  // market.candles가 바뀔 때만 차트 좌표를 다시 계산한다.
  const chartMeta = useMemo(
    () => buildChartMeta(chartState.candles, 640, 320, appliedMovingAveragePeriods[selectedInterval]),
    [chartState.candles, appliedMovingAveragePeriods, selectedInterval],
  );

  useEffect(() => {
    if (selectedInterval !== "1s") {
      return;
    }

    setChartState((previousState) => ({
      ...previousState,
      interval: "1s",
      candles: market.candles,
      connectionStatus: market.connectionStatus,
      connectionLabel: market.connectionLabel,
      isLoading: market.isHydrating && market.candles.length === 0,
    }));
  }, [selectedInterval, market.candles, market.connectionStatus, market.connectionLabel, market.isHydrating]);

  // 실행 순서 4:
  // 최신 state를 바탕으로 루트 VNode 트리를 만든다.
  return h(
    "main",
    { className: "page" },
    h(Header, { market }),
    h(
      "section",
      { className: "dashboard-grid" },
      h(
        "div",
        { className: "stack" },
        h(PricePanel, { market }),
        h(ChartPanel, {
          chartState,
          selectedInterval,
          onSelectInterval: setSelectedInterval,
          movingAverageInput: movingAverageInputs[selectedInterval],
          appliedMovingAveragePeriod: appliedMovingAveragePeriods[selectedInterval],
          onMovingAverageInputChange: (value) =>
            setMovingAverageInputs((previousState) => ({
              ...previousState,
              [selectedInterval]: value,
            })),
          onApplyMovingAverage: () => {
            const parsed = Number(movingAverageInputs[selectedInterval]);

            if (!Number.isInteger(parsed) || parsed < 5 || parsed > 20) {
              return;
            }

            setAppliedMovingAveragePeriods((previousState) => ({
              ...previousState,
              [selectedInterval]: parsed,
            }));
          },
          chartMeta,
        }),
      ),
      h(
        "div",
        { className: "stack" },
        h(TradesPanel, { trades: market.trades, feedMode: market.feedMode }),
      ),
    ),
    h("div", { className: "footer-note" }, `Built with our custom FunctionComponent runtime. No react, no react-dom. Source: ${market.connectionLabel}.`),
  );
}
