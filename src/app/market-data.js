const BASE_PRICE = 69043.3;
const SERIES_LENGTH = 24;
const TRADE_HISTORY_LENGTH = 8;

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function createSeriesPoint(price, timestamp) {
  return {
    price: round(price, 1),
    timestamp,
  };
}

function createTrade(id, price, side, timestamp, amount) {
  return {
    id,
    price: round(price, 1),
    side,
    time: formatClock(timestamp),
    amount: round(amount, 3),
  };
}

function buildSeries(basePrice, now) {
  const series = [];
  let price = basePrice - 86;

  for (let index = 0; index < SERIES_LENGTH; index += 1) {
    price += (Math.sin(index * 0.72) + Math.cos(index * 0.41)) * 11 + (index % 3 === 0 ? 5 : -2);
    series.push(createSeriesPoint(price, now - (SERIES_LENGTH - index) * 1000));
  }

  return series;
}

function buildTrades(series) {
  return series.slice(-TRADE_HISTORY_LENGTH).map((entry, index) =>
    createTrade(
      `seed-${index}`,
      entry.price + (index % 2 === 0 ? 0.4 : -0.3),
      index % 2 === 0 ? "BUY" : "SELL",
      entry.timestamp,
      0.18 + (index + 1) * 0.071,
    ),
  );
}

function computeStats(series, price) {
  const prices = series.map((entry) => entry.price);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const open = series[0].price;
  const volumeBtc = 228.5 + Math.abs(price - open) * 0.84;
  const volumeUsdt = volumeBtc * price;
  const openInterest = 6256999555.16 + (price - BASE_PRICE) * 12400;

  return {
    high: round(high, 1),
    low: round(low, 1),
    open: round(open, 1),
    volumeBtc: round(volumeBtc, 3),
    volumeUsdt: round(volumeUsdt, 0),
    openInterest: round(openInterest, 2),
  };
}

export function createInitialMarketState() {
  const now = Date.now();
  const series = buildSeries(BASE_PRICE, now);
  const price = series.at(-1).price;
  const previousClose = series.at(-2).price;
  const change = round(price - previousClose, 1);
  const changePercent = round((change / previousClose) * 100, 2);

  return {
    symbol: "BTCUSDT",
    price,
    previousClose,
    change,
    changePercent,
    lastUpdated: now,
    series,
    trades: buildTrades(series),
    stats: computeStats(series, price),
  };
}

export function advanceMarketState(previousState) {
  const now = previousState.lastUpdated + 1000;
  const directionBias = Math.sin(now / 4400) * 12;
  const variance = Math.cos(now / 1700) * 6;
  const drift = (Math.random() - 0.5) * 14;
  const price = round(previousState.price + directionBias * 0.2 + variance * 0.18 + drift, 1);
  const series = [...previousState.series.slice(1), createSeriesPoint(price, now)];
  const previousClose = previousState.price;
  const change = round(price - previousClose, 1);
  const changePercent = round((change / previousClose) * 100, 2);
  const side = change >= 0 ? "BUY" : "SELL";
  const amount = 0.12 + Math.random() * 1.35;
  const trades = [
    ...previousState.trades.slice(-TRADE_HISTORY_LENGTH + 1),
    createTrade(`trade-${now}`, price, side, now, amount),
  ];

  return {
    ...previousState,
    price,
    previousClose,
    change,
    changePercent,
    lastUpdated: now,
    series,
    trades,
    stats: computeStats(series, price),
  };
}

export function buildChartMeta(series, width, height) {
  const prices = series.map((entry) => entry.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = Math.max(max - min, 1);

  const coordinates = series.map((entry, index) => {
    const x = (index / Math.max(series.length - 1, 1)) * width;
    const y = height - ((entry.price - min) / spread) * height;
    return {
      x: round(x, 2),
      y: round(y, 2),
    };
  });

  return {
    min,
    max,
    linePoints: coordinates.map(({ x, y }) => `${x},${y}`).join(" "),
    areaPoints: `0,${height} ${coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} ${width},${height}`,
  };
}

export function formatPrice(value) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatSignedPercent(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSignedPrice(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatPrice(value)}`;
}

export function formatCompactNumber(value) {
  return value.toLocaleString("en-US");
}

export function formatClock(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);
}
