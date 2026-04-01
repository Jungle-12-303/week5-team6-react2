import { createElement as h, useEffect, useMemo, useState } from "../lib/runtime.js";
import {
  advanceMarketState,
  buildChartMeta,
  createInitialMarketState,
  formatClock,
  formatCompactNumber,
  formatPrice,
  formatSignedPercent,
  formatSignedPrice,
} from "./market-data.js";

function Header({ lastUpdated }) {
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
        "기존 React 패키지 없이 우리가 만든 런타임만으로 렌더링되는 비트코인 실시간 대시보드입니다. 1초마다 가격, 차트, 체결 히스토리가 갱신됩니다.",
      ),
    ),
    h(
      "div",
      { className: "hero-meta" },
      h("span", { className: "meta-chip" }, `Render Engine: FunctionComponent + Hooks`),
      h("span", { className: "meta-chip" }, `Last Tick: ${formatClock(lastUpdated)}`),
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
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "24H High"), h("div", { className: "stat-value" }, formatPrice(market.stats.high))),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "24H Low"), h("div", { className: "stat-value" }, formatPrice(market.stats.low))),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "24H Volume (BTC)"), h("div", { className: "stat-value" }, formatPrice(market.stats.volumeBtc))),
        h("article", { className: "stat-card" }, h("div", { className: "stat-label" }, "Open Interest (USDT)"), h("div", { className: "stat-value" }, formatCompactNumber(market.stats.openInterest))),
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
        h("p", { className: "panel-subtitle" }, `1초 단위 mock tick으로 ${market.series.length}개 포인트를 유지합니다.`),
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

function TradesPanel({ trades }) {
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
        h("p", { className: "panel-subtitle" }, "가장 최근 체결이 위로 올라오며 1초마다 새로운 행이 추가됩니다."),
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
              h("td", null, `${trade.amount.toFixed(3)} BTC`),
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
      h("div", { className: "ticker-name" }, "Prev Close"),
      h("div", { className: "ticker-value" }, formatPrice(market.previousClose)),
      h("div", { className: "ticker-change" }, "직전 1초 기준값"),
    ),
    h(
      "article",
      { className: "ticker-card" },
      h("div", { className: "ticker-name" }, "24H Open"),
      h("div", { className: "ticker-value" }, formatPrice(market.stats.open)),
      h("div", { className: "ticker-change" }, "오늘 시가"),
    ),
    h(
      "article",
      { className: "ticker-card" },
      h("div", { className: "ticker-name" }, "24H Volume"),
      h("div", { className: "ticker-value" }, `${market.stats.volumeBtc.toFixed(1)} BTC`),
      h("div", { className: "ticker-change" }, `${formatCompactNumber(market.stats.volumeUsdt)} USDT`),
    ),
    h(
      "article",
      { className: "ticker-card" },
      h("div", { className: "ticker-name" }, "Realtime Mode"),
      h("div", { className: "ticker-value positive" }, "1s Mock Feed"),
      h("div", { className: "ticker-change" }, "다음 단계에서 실제 피드로 교체 가능"),
    ),
  );
}

export function App() {
  const [market, setMarket] = useState(() => createInitialMarketState());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMarket((previousState) => advanceMarketState(previousState));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const chartMeta = useMemo(() => buildChartMeta(market.series, 640, 320), [market.series]);

  return h(
    "main",
    { className: "page" },
    h(Header, { lastUpdated: market.lastUpdated }),
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
        h(TradesPanel, { trades: market.trades }),
      ),
    ),
    h(TickerStrip, { market }),
    h("div", { className: "footer-note" }, "Built with our custom FunctionComponent runtime. No react, no react-dom."),
  );
}
