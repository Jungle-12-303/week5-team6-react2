const BASE_PRICE = 69043.3;
const SERIES_LENGTH = 120;
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

function createCandle(timestamp, open, high, low, close, volume = 0) {
  return {
    timestamp,
    open: round(open, 1),
    high: round(high, 1),
    low: round(low, 1),
    close: round(close, 1),
    volume: round(volume, 3),
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

function normalizePrice(value, fallback = BASE_PRICE) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? round(parsed, 1) : fallback;
}

function buildSeedCandles(basePrice, now) {
  const candles = [];
  let price = basePrice - 86;

  for (let index = 0; index < SERIES_LENGTH; index += 1) {
    const open = price;
    const movement = (Math.sin(index * 0.72) + Math.cos(index * 0.41)) * 11 + (index % 3 === 0 ? 5 : -2);
    const close = round(open + movement, 1);
    const high = Math.max(open, close) + 2.4 + (index % 4);
    const low = Math.min(open, close) - 2.1 - ((index + 1) % 3);
    const timestamp = now - (SERIES_LENGTH - index) * 1000;

    candles.push(createCandle(timestamp, open, high, low, close, 0.24 + index * 0.014));
    price = close;
  }

  return candles;
}

function buildFlatSeedCandles(basePrice, now) {
  const candles = [];

  for (let index = 0; index < SERIES_LENGTH; index += 1) {
    const timestamp = now - (SERIES_LENGTH - index) * 1000;
    candles.push(createCandle(timestamp, basePrice, basePrice, basePrice, basePrice, 0));
  }

  return candles;
}

function candlesToSeries(candles) {
  return candles.map((candle) => createSeriesPoint(candle.close, candle.timestamp));
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

function computeSessionStats(series, volumeBtc, volumeUsdt) {
  const prices = series.map((entry) => entry.price);

  return {
    high: round(Math.max(...prices), 1),
    low: round(Math.min(...prices), 1),
    open: round(series[0].price, 1),
    volumeBtc: round(volumeBtc, 3),
    volumeUsdt: round(volumeUsdt, 0),
  };
}

function pushCandle(candles, price, timestamp, volume = 0) {
  const bucketTimestamp = Math.floor(timestamp / 1000) * 1000;
  const lastCandle = candles.at(-1);

  if (!lastCandle) {
    return [createCandle(bucketTimestamp, price, price, price, price, volume)];
  }

  const nextCandles = [...candles];

  if (lastCandle.timestamp === bucketTimestamp) {
    nextCandles[nextCandles.length - 1] = createCandle(
      lastCandle.timestamp,
      lastCandle.open,
      Math.max(lastCandle.high, price),
      Math.min(lastCandle.low, price),
      price,
      lastCandle.volume + volume,
    );
    return nextCandles;
  }

  let previousClose = lastCandle.close;
  let nextTimestamp = lastCandle.timestamp + 1000;

  while (nextTimestamp < bucketTimestamp) {
    nextCandles.push(createCandle(nextTimestamp, previousClose, previousClose, previousClose, previousClose, 0));
    previousClose = nextCandles.at(-1).close;
    nextTimestamp += 1000;
  }

  nextCandles.push(createCandle(bucketTimestamp, previousClose, Math.max(previousClose, price), Math.min(previousClose, price), price, volume));

  return nextCandles.slice(-SERIES_LENGTH);
}

function upsertTrade(trades, trade) {
  const existingIndex = trades.findIndex((entry) => entry.id === trade.id);
  const nextTrades = existingIndex >= 0
    ? trades.map((entry, index) => (index === existingIndex ? trade : entry))
    : [...trades, trade];

  return nextTrades.slice(-TRADE_HISTORY_LENGTH);
}

function bootstrapLiveState(previousState, price, timestamp, amount = 0, trade = null) {
  const candles = pushCandle(buildFlatSeedCandles(price, timestamp), price, timestamp, amount);
  const series = candlesToSeries(candles);
  const stats = computeSessionStats(series, amount, amount * price);

  return {
    ...previousState,
    price,
    previousClose: price,
    change: 0,
    changePercent: 0,
    lastUpdated: timestamp,
    candles,
    series,
    trades: trade ? upsertTrade([], trade) : [],
    stats,
    feedMode: "live",
    connectionStatus: "live",
    connectionLabel: "Binance Futures live feed",
  };
}

export function createInitialMarketState() {
  const now = Date.now();
  const candles = buildSeedCandles(BASE_PRICE, now);
  const series = candlesToSeries(candles);
  const price = candles.at(-1).close;
  const previousClose = candles.at(-2).close;
  const change = round(price - previousClose, 1);
  const changePercent = round((change / previousClose) * 100, 2);

  return {
    symbol: "BTCUSDT",
    price,
    previousClose,
    change,
    changePercent,
    lastUpdated: now,
    candles,
    series,
    trades: buildTrades(series),
    stats: computeStats(series, price),
    feedMode: "mock",
    connectionStatus: "mock",
    connectionLabel: "Mock market feed",
  };
}

export function advanceMarketState(previousState) {
  const now = previousState.lastUpdated + 1000;
  const directionBias = Math.sin(now / 4400) * 12;
  const variance = Math.cos(now / 1700) * 6;
  const drift = (Math.random() - 0.5) * 14;
  const price = round(previousState.price + directionBias * 0.2 + variance * 0.18 + drift, 1);
  const candles = pushCandle(previousState.candles, price, now, 0.35 + Math.random() * 0.85);
  const series = candlesToSeries(candles);
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
    candles,
    series,
    trades,
    stats: computeStats(series, price),
    feedMode: "mock",
    connectionStatus: "mock",
    connectionLabel: "Mock market feed",
  };
}

export function setMarketConnection(previousState, status, label) {
  return {
    ...previousState,
    connectionStatus: status,
    connectionLabel: label,
  };
}

export function applyLivePriceUpdate(previousState, payload) {
  const timestamp = Number(payload.E) || Date.now();
  const price = normalizePrice(payload.p, previousState.price);

  if (previousState.feedMode !== "live") {
    return bootstrapLiveState(previousState, price, timestamp);
  }

  const previousClose = previousState.price;
  const change = round(price - previousClose, 1);
  const changePercent = previousClose === 0 ? 0 : round((change / previousClose) * 100, 2);

  return {
    ...previousState,
    price,
    previousClose,
    change,
    changePercent,
    lastUpdated: timestamp,
    feedMode: "live",
    connectionStatus: "live",
    connectionLabel: "Binance Futures live feed",
  };
}

export function applyLiveTradeUpdate(previousState, payload) {
  const timestamp = Number(payload.T) || Number(payload.E) || Date.now();
  const price = normalizePrice(payload.p, previousState.price);
  const amount = Number(payload.q) || 0;
  const side = payload.m ? "SELL" : "BUY";
  const trade = createTrade(String(payload.a ?? timestamp), price, side, timestamp, amount);

  if (previousState.feedMode !== "live") {
    return bootstrapLiveState(previousState, price, timestamp, amount, trade);
  }

  const candles = pushCandle(previousState.candles, price, timestamp, amount);
  const series = candlesToSeries(candles);
  const volumeBtc = previousState.stats.volumeBtc + amount;
  const volumeUsdt = previousState.stats.volumeUsdt + amount * price;
  const stats = computeSessionStats(series, volumeBtc, volumeUsdt);

  return {
    ...previousState,
    price,
    previousClose: previousState.price,
    change: round(price - previousState.price, 1),
    changePercent: previousState.price === 0 ? 0 : round(((price - previousState.price) / previousState.price) * 100, 2),
    lastUpdated: timestamp,
    candles,
    series,
    trades: upsertTrade(previousState.trades, trade),
    stats,
    feedMode: "live",
    connectionStatus: "live",
    connectionLabel: "Binance Futures live feed",
  };
}

export function buildChartMeta(candles, width, height) {
  const lows = candles.map((candle) => candle.low);
  const highs = candles.map((candle) => candle.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const spread = Math.max(max - min, 1);
  const step = width / Math.max(candles.length, 1);
  const candleWidth = Math.max(step * 0.62, 2);
  const toY = (price) => round(height - ((price - min) / spread) * height, 2);
  const candleShapes = candles.map((candle, index) => {
    const centerX = round(index * step + step / 2, 2);
    const openY = toY(candle.open);
    const closeY = toY(candle.close);
    const highY = toY(candle.high);
    const lowY = toY(candle.low);
    const rising = candle.close >= candle.open;
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5);

    return {
      key: `${candle.timestamp}-${index}`,
      centerX,
      openY,
      closeY,
      highY,
      lowY,
      bodyX: round(centerX - candleWidth / 2, 2),
      bodyY: round(bodyTop, 2),
      bodyWidth: round(candleWidth, 2),
      bodyHeight: round(bodyHeight, 2),
      color: rising ? "#2dd4bf" : "#fb7185",
      rising,
    };
  });

  return {
    min,
    max,
    candleWidth: round(candleWidth, 2),
    candles: candleShapes,
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

export function formatAmount(value) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
