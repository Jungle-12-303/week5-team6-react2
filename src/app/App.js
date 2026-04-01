import { createElement as h, useEffect, useMemo, useState } from "../lib/runtime.js";
import {
  advanceMarketState,
  applyLivePriceUpdate,
  applyLiveTradeUpdate,
  buildChartMeta,
  createInitialMarketState,
  formatAmount,
  formatClock,
  formatCompactNumber,
  formatPrice,
  formatSignedPercent,
  formatSignedPrice,
  setMarketConnection,
} from "./market-data.js";
import { connectBinanceFeed } from "./binance-feed.js";

function Header({ market }) {
  return h(
    "section",
    { className: "hero" },
    h(
      "div",
      { className: "hero-copy" },
      h("span", { className: "eyebrow" }, "Custom Runtime Only"),
      h("h1", null, "BTC Live Board"),
      h(
        "p",
        null,
        "기존 React 패키지 없이 우리가 만든 런타임만으로 렌더링되는 비트코인 실시간 대시보드입니다. Binance Futures 공개 WebSocket 시장 데이터를 우선 사용하고, 연결 실패 시에만 mock 피드로 대체합니다.",
      ),
    ),
    h(
      "div",
      { className: "hero-meta" },
      h("span", { className: "meta-chip" }, `Render Engine: FunctionComponent + Hooks`),
      h("span", { className: "meta-chip" }, `Feed: ${market.connectionLabel}`),
      h("span", { className: "meta-chip" }, `Last Tick: ${formatClock(market.lastUpdated)}`),
    ),
  );
}

function PricePanel({ market }) {
  const trendClass = market.change >= 0 ? "positive" : "negative";

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
          h("span", { className: `price-number ${trendClass}` }, formatPrice(market.price)),
          h("span", { className: `price-delta ${trendClass}` }, formatSignedPercent(market.changePercent)),
        ),
        h("div", { className: "price-note" }, `Tick delta ${formatSignedPrice(market.change)} · Updated ${formatClock(market.lastUpdated)}`),
      ),
      h(
        "div",
        { className: "stats-grid" },
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Session High"), h("div", { className: "stat-value" }, formatPrice(market.stats.high))),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Session Low"), h("div", { className: "stat-value" }, formatPrice(market.stats.low))),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Feed Volume (BTC)"), h("div", { className: "stat-value" }, formatAmount(market.stats.volumeBtc))),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Feed Volume (USDT)"), h("div", { className: "stat-value" }, formatCompactNumber(market.stats.volumeUsdt))),
      ),
    ),
  );
}

function ChartPanel({ market, chartMeta }) {
  return h(
    "section",
    { className: "panel chart-panel" },
    h(
      "div",
      { className: "panel-header" },
      h(
        "div",
        null,
        h("h2", { className: "panel-title" }, "Realtime Price Graph"),
        h("p", { className: "panel-subtitle" }, `${market.feedMode === "live" ? "Binance markPrice@1s" : "Mock tick"} 기준으로 ${market.series.length}개 포인트를 유지합니다.`),
      ),
      h("span", { className: "meta-chip" }, `Range ${formatPrice(chartMeta.min)} - ${formatPrice(chartMeta.max)}`),
    ),
    h(
      "div",
      { className: "chart-legend" },
      h("span", { className: "legend-item" }, h("span", { className: "legend-swatch swatch-line" }), "Last price line"),
      h("span", { className: "legend-item" }, h("span", { className: "legend-swatch swatch-fill" }), "Realtime area"),
    ),
    h(
      "div",
      { className: "chart-frame" },
      h(
        "svg",
        { className: "chart-canvas", viewBox: "0 0 640 320", preserveAspectRatio: "none" },
        h(
          "defs",
          null,
          h(
            "linearGradient",
            { id: "chart-fill", x1: "0", x2: "0", y1: "0", y2: "1" },
            h("stop", { offset: "0%", stopColor: "rgba(99, 179, 255, 0.34)" }),
            h("stop", { offset: "100%", stopColor: "rgba(99, 179, 255, 0.02)" }),
          ),
        ),
        h("polygon", { points: chartMeta.areaPoints, fill: "url(#chart-fill)" }),
        h("polyline", {
          points: chartMeta.linePoints,
          fill: "none",
          stroke: "#f7b731",
          strokeWidth: "4",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      ),
    ),
  );
}

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
      h(
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

function TickerStrip({ market }) {
  return h(
    "section",
      { className: "ticker-strip" },
      h(
        "article",
        { className: "ticker-card" },
      h("div", { className: "ticker-name" }, "Prev Tick"),
      h("div", { className: "ticker-value" }, formatPrice(market.previousClose)),
      h("div", { className: "ticker-change" }, "직전 수신 가격"),
    ),
    h(
      "article",
      { className: "ticker-card" },
      h("div", { className: "ticker-name" }, "Session Open"),
      h("div", { className: "ticker-value" }, formatPrice(market.stats.open)),
      h("div", { className: "ticker-change" }, "현재 세션 시작 가격"),
    ),
    h(
      "article",
      { className: "ticker-card" },
      h("div", { className: "ticker-name" }, "Realtime Volume"),
      h("div", { className: "ticker-value" }, `${formatAmount(market.stats.volumeBtc)} BTC`),
      h("div", { className: "ticker-change" }, `${formatCompactNumber(market.stats.volumeUsdt)} USDT`),
    ),
    h(
      "article",
      { className: "ticker-card" },
      h("div", { className: "ticker-name" }, "Feed Status"),
      h("div", { className: `ticker-value ${market.feedMode === "live" ? "positive" : "negative"}` }, market.feedMode === "live" ? "Binance Live" : "Mock Fallback"),
      h("div", { className: "ticker-change" }, market.connectionLabel),
    ),
  );
}

export function App() {
  const [market, setMarket] = useState(() => createInitialMarketState());

  useEffect(() => {
    let mockTimer = null;

    const stopMockFeed = () => {
      if (mockTimer) {
        window.clearInterval(mockTimer);
        mockTimer = null;
      }
    };

    const startMockFeed = (reason) => {
      setMarket((previousState) => setMarketConnection(previousState, "mock", reason));
      if (mockTimer) {
        return;
      }

      mockTimer = window.setInterval(() => {
        setMarket((previousState) => advanceMarketState(previousState));
      }, 1000);
    };

    const disconnect = connectBinanceFeed({
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

    return () => {
      stopMockFeed();
      disconnect();
    };
  }, []);

  const chartMeta = useMemo(() => buildChartMeta(market.series, 640, 320), [market.series]);

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
        h(ChartPanel, { market, chartMeta }),
      ),
      h(
        "div",
        { className: "stack" },
        h(TradesPanel, { trades: market.trades, feedMode: market.feedMode }),
      ),
    ),
    h(TickerStrip, { market }),
    h("div", { className: "footer-note" }, `Built with our custom FunctionComponent runtime. No react, no react-dom. Source: ${market.connectionLabel}.`),
  );
}
