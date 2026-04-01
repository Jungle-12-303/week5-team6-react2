// 대시보드가 시작될 때 사용하는 기본 가격대다.
// mock 데이터를 만들 때 출발점 역할을 한다.
const BASE_PRICE = 69043.3;

// 차트에 몇 개의 1초 캔들을 유지할지 결정한다.
const SERIES_LENGTH = 120;

// 계약 히스토리 표에 몇 개의 최근 체결을 유지할지 결정한다.
const TRADE_HISTORY_LENGTH = 8;

// 차트 interval 선택 버튼에서 사용하는 기본 값이다.
const DEFAULT_CHART_INTERVAL = "1s";
const MIN_REQUIRED_KLINE_CANDLES = 20;

/**
 * 소수점 자릿수를 통일하기 위한 공용 반올림 함수다.
 */
function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * 축 눈금 간격을 사람이 읽기 쉬운 값으로 보정한다.
 *
 * 예:
 * - 0.73  -> 1
 * - 2.18  -> 2
 * - 4.92  -> 5
 * - 13.4  -> 10
 */
function getNiceStep(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;

  if (fraction <= 1.5) {
    return 10 ** exponent;
  }

  if (fraction <= 3) {
    return 2 * 10 ** exponent;
  }

  if (fraction <= 7) {
    return 5 * 10 ** exponent;
  }

  return 10 ** (exponent + 1);
}

/**
 * 종가 기준 이동평균선을 SVG 좌표 배열로 변환한다.
 *
 * period가 5면 최근 5개 캔들의 종가 평균,
 * period가 20이면 최근 20개 캔들의 종가 평균을 사용한다.
 */
function buildMovingAveragePoints(candles, period, step, toY) {
  const points = [];

  for (let index = period - 1; index < candles.length; index += 1) {
    const slice = candles.slice(index - period + 1, index + 1);
    const average = slice.reduce((sum, candle) => sum + candle.close, 0) / period;
    const centerX = round(index * step + step / 2, 2);

    points.push({
      x: centerX,
      y: toY(average),
    });
  }

  return points;
}

/**
 * 차트 계산에 쓰는 "가격 시계열 한 점"을 만든다.
 *
 * close price를 뽑아서 단순 시계열로 다룰 때 사용한다.
 */
function createSeriesPoint(price, timestamp) {
  return {
    price: round(price, 1),
    timestamp,
  };
}

/**
 * 1초 캔들 한 개를 만드는 함수다.
 *
 * 객체 구조:
 * - open: 시작가
 * - high: 고가
 * - low: 저가
 * - close: 종가
 * - volume: 그 1초 안의 누적 거래량
 */
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

/**
 * 계약 히스토리 표에 들어갈 trade 객체를 만든다.
 */
function createTrade(id, price, side, timestamp, amount) {
  return {
    id,
    price: round(price, 1),
    side,
    time: formatClock(timestamp),
    amount: round(amount, 3),
  };
}

/**
 * kline interval 문자열을 사람이 읽기 쉬운 라벨로 바꾼다.
 */
export function getChartIntervalLabel(interval) {
  if (interval === "1s") {
    return "1s";
  }

  if (interval === "5m") {
    return "5m";
  }

  return "1m";
}

/**
 * 외부 데이터에서 넘어온 가격 문자열/숫자를 안전하게 숫자로 바꾼다.
 *
 * 값이 비정상이면 fallback 가격을 사용한다.
 */
function normalizePrice(value, fallback = BASE_PRICE) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? round(parsed, 1) : fallback;
}

/**
 * Binance REST/WebSocket kline 데이터를 공통 candle 객체로 변환한다.
 */
function normalizeKlineCandle(entry) {
  if (Array.isArray(entry)) {
    return createCandle(
      Number(entry[0]) || Date.now(),
      Number(entry[1]) || BASE_PRICE,
      Number(entry[2]) || BASE_PRICE,
      Number(entry[3]) || BASE_PRICE,
      Number(entry[4]) || BASE_PRICE,
      Number(entry[5]) || 0,
    );
  }

  return createCandle(
    Number(entry.t) || Date.now(),
    Number(entry.o) || BASE_PRICE,
    Number(entry.h) || BASE_PRICE,
    Number(entry.l) || BASE_PRICE,
    Number(entry.c) || BASE_PRICE,
    Number(entry.v) || 0,
  );
}

/**
 * mock 모드에서 사용할 "움직이는 시드 캔들"을 만든다.
 *
 * 실행 순서 A-1:
 * 앱이 처음 켜졌지만 아직 live 데이터가 없을 때, 화면이 비어 보이지 않도록
 * 미리 120개의 가짜 1초 캔들을 만든다.
 */
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

/**
 * live 데이터가 처음 들어왔을 때 사용할 "평평한 시드 캔들"을 만든다.
 *
 * 왜 필요한가?
 * - 새로고침 직후 mock 가격대와 live 가격대가 다르면 차트가 갑자기 수직으로 튀어 보인다.
 * - 그래서 첫 live 가격이 들어오는 순간, 그 가격을 기준으로 120초 창을 다시 맞춘다.
 */
function buildFlatSeedCandles(basePrice, now) {
  const candles = [];

  for (let index = 0; index < SERIES_LENGTH; index += 1) {
    const timestamp = now - (SERIES_LENGTH - index) * 1000;
    candles.push(createCandle(timestamp, basePrice, basePrice, basePrice, basePrice, 0));
  }

  return candles;
}

/**
 * 차트용 별도 state의 초기값을 만든다.
 *
 * 가격/체결 히스토리와 분리해서, 공식 kline 데이터가 올 때까지
 * 빈 차트 + loading 상태로 시작한다.
 */
export function createInitialChartState() {
  return {
    interval: DEFAULT_CHART_INTERVAL,
    candles: [],
    connectionStatus: "connecting",
    connectionLabel: "Loading Binance kline data",
    isLoading: true,
    error: null,
    historyReady: false,
  };
}

/**
 * 캔들 배열을 "종가 기반 시계열 배열"로 변환한다.
 *
 * 차트 범위 계산이나 일부 보조 통계에서 close 값만 필요할 때 사용한다.
 */
function candlesToSeries(candles) {
  return candles.map((candle) => createSeriesPoint(candle.close, candle.timestamp));
}

/**
 * mock 시계열을 기반으로 초기 계약 히스토리를 만든다.
 */
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

/**
 * mock 모드에서 사용하는 통계를 계산한다.
 *
 * 현재는 beginner-friendly 데모용이므로 일부 값은 실제 거래소 값과 완전히 동일하지 않고,
 * 차트/가격 흐름에 맞춘 가공값이다.
 */
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

/**
 * live/mock 공통으로 쓸 수 있는 "현재 시계열 기준 통계"를 계산한다.
 */
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

/**
 * 새 가격 이벤트를 기존 캔들 배열에 반영한다.
 *
 * 실행 순서 B-1:
 * - 같은 초 버킷이면 마지막 캔들의 high/low/close/volume만 갱신
 * - 다음 초로 넘어가면 새 캔들을 추가
 * - 중간에 빈 초가 있으면 이전 종가 기준의 평평한 캔들을 채워 넣음
 */
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

/**
 * 같은 trade id가 다시 들어오면 덮어쓰고, 아니면 새로 추가한다.
 */
function upsertTrade(trades, trade) {
  const existingIndex = trades.findIndex((entry) => entry.id === trade.id);
  const nextTrades = existingIndex >= 0
    ? trades.map((entry, index) => (index === existingIndex ? trade : entry))
    : [...trades, trade];

  return nextTrades.slice(-TRADE_HISTORY_LENGTH);
}

/**
 * 첫 live 이벤트가 들어왔을 때 mock 시드를 버리고 실제 가격 기준 차트 창을 재구성한다.
 *
 * 실행 순서 B-2:
 * refresh 직후 mock 가격대와 live 가격대가 어긋나는 문제를 해결하는 핵심 함수다.
 */
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
    isHydrating: false,
  };
}

/**
 * REST로 받아온 최근 aggTrade 목록을 초기 live market state로 변환한다.
 *
 * 왜 필요한가?
 * - 새로고침 직후 현재가 기준 평평한 baseline 대신
 *   "지금 시점 이전의 실제 거래 흐름"을 먼저 보여주기 위해서다.
 * - REST backfill 이후에는 WebSocket live 이벤트가 그대로 이어 붙는다.
 */
export function buildMarketStateFromAggTrades(previousState, trades, now = Date.now()) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return previousState;
  }

  const sortedTrades = [...trades]
    .map((trade) => ({
      id: String(trade.a ?? trade.id ?? `${trade.T ?? trade.E ?? now}-${trade.p}`),
      price: normalizePrice(trade.p, previousState.price),
      amount: Number(trade.q) || 0,
      timestamp: Number(trade.T) || Number(trade.E) || now,
      side: trade.m ? "SELL" : "BUY",
    }))
    .sort((left, right) => left.timestamp - right.timestamp);

  const firstTrade = sortedTrades[0];
  const lastTrade = sortedTrades.at(-1);
  const anchorTimestamp = Math.max(now, lastTrade.timestamp);
  let candles = buildFlatSeedCandles(firstTrade.price, anchorTimestamp);
  let recentTrades = [];
  let volumeBtc = 0;
  let volumeUsdt = 0;

  sortedTrades.forEach((trade) => {
    candles = pushCandle(candles, trade.price, trade.timestamp, trade.amount);
    volumeBtc += trade.amount;
    volumeUsdt += trade.amount * trade.price;
    recentTrades = upsertTrade(
      recentTrades,
      createTrade(trade.id, trade.price, trade.side, trade.timestamp, trade.amount),
    );
  });

  const series = candlesToSeries(candles);
  const previousClose = sortedTrades.length > 1 ? sortedTrades[sortedTrades.length - 2].price : firstTrade.price;
  const price = lastTrade.price;
  const change = round(price - previousClose, 1);
  const changePercent = previousClose === 0 ? 0 : round((change / previousClose) * 100, 2);

  return {
    ...previousState,
    price,
    previousClose,
    change,
    changePercent,
    lastUpdated: lastTrade.timestamp,
    candles,
    series,
    trades: recentTrades,
    stats: computeSessionStats(series, volumeBtc, volumeUsdt),
    feedMode: "live",
    connectionStatus: "live",
    connectionLabel: "Binance Futures live feed",
    isHydrating: false,
    error: null,
    historyReady: true,
  };
}

/**
 * REST로 받아온 kline 배열을 차트 전용 state로 변환한다.
 */
export function buildChartStateFromKlines(previousState, klines, interval) {
  if (!Array.isArray(klines) || klines.length === 0) {
    return {
      ...previousState,
      interval,
      candles: [],
      connectionStatus: "error",
      connectionLabel: `Binance ${getChartIntervalLabel(interval)} kline backfill unavailable`,
      isLoading: false,
      error: `Failed to load recent ${getChartIntervalLabel(interval)} candles.`,
      historyReady: false,
    };
  }

  const candles = klines.map((entry) => normalizeKlineCandle(entry)).slice(-120);
  const historyReady = candles.length >= MIN_REQUIRED_KLINE_CANDLES;

  return {
    ...previousState,
    interval,
    candles,
    connectionStatus: "live",
    connectionLabel: `Binance ${getChartIntervalLabel(interval)} kline feed`,
    isLoading: false,
    error: historyReady ? null : `Only ${candles.length} ${getChartIntervalLabel(interval)} candles loaded.`,
    historyReady,
  };
}

/**
 * 실시간 kline 이벤트를 차트 전용 state에 반영한다.
 */
export function applyLiveKlineUpdate(previousState, payload, interval) {
  const source = payload?.k ?? payload;
  const nextCandle = normalizeKlineCandle(source);
  const lastCandle = previousState.candles.at(-1);
  let candles;

  if (lastCandle && lastCandle.timestamp === nextCandle.timestamp) {
    candles = [...previousState.candles.slice(0, -1), nextCandle];
  } else {
    candles = [...previousState.candles, nextCandle].slice(-120);
  }

  const historyReady = previousState.historyReady || candles.length >= MIN_REQUIRED_KLINE_CANDLES;

  return {
    ...previousState,
    interval,
    candles,
    connectionStatus: "live",
    connectionLabel: `Binance ${getChartIntervalLabel(interval)} kline feed`,
    isLoading: false,
    error: historyReady ? null : previousState.error,
    historyReady,
  };
}

/**
 * 앱 시작 시 사용할 초기 market state를 만든다.
 *
 * 실행 순서 A:
 * App의 useState 초기값으로 한 번만 호출된다.
 */
export function createInitialMarketState() {
  const now = Date.now();

  return {
    symbol: "BTCUSDT",
    price: null,
    previousClose: null,
    change: 0,
    changePercent: 0,
    dailyChange: 0,
    dailyChangePercent: 0,
    lastUpdated: now,
    candles: [],
    series: [],
    trades: [],
    stats: {
      high: null,
      low: null,
      open: null,
      volumeBtc: 0,
      volumeUsdt: 0,
      openInterest: 0,
    },
    feedMode: "loading",
    connectionStatus: "connecting",
    connectionLabel: "Loading recent Binance trades",
    isHydrating: true,
    error: null,
    historyReady: false,
  };
}

/**
 * Binance 24시간 ticker 응답을 market state에 반영한다.
 *
 * 역할:
 * - 가격 옆에 보이는 퍼센트는 tick 변화율이 아니라 24시간 변화율을 사용한다.
 * - 아래 Tick delta는 기존 실시간 체결 기준 변화를 그대로 유지한다.
 */
export function apply24hrTickerStats(previousState, ticker) {
  const dailyChange = Number(ticker?.priceChange);
  const dailyChangePercent = Number(ticker?.priceChangePercent);

  if (!Number.isFinite(dailyChange) || !Number.isFinite(dailyChangePercent)) {
    return previousState;
  }

  return {
    ...previousState,
    dailyChange: round(dailyChange, 1),
    dailyChangePercent: round(dailyChangePercent, 2),
  };
}

/**
 * mock 모드에서 다음 1초 상태를 만든다.
 *
 * 실행 순서 C:
 * live 피드가 없을 때 setInterval에서 호출된다.
 */
export function advanceMarketState(previousState) {
  if (!previousState.candles.length || !Number.isFinite(previousState.price)) {
    const now = Date.now();
    const candles = buildSeedCandles(BASE_PRICE, now);
    const series = candlesToSeries(candles);
    const price = candles.at(-1).close;
    const previousClose = candles.at(-2).close;
    const change = round(price - previousClose, 1);
    const changePercent = round((change / previousClose) * 100, 2);

    return {
      ...previousState,
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
      isHydrating: false,
    };
  }

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
    isHydrating: false,
  };
}

/**
 * 연결 상태 문자열만 업데이트한다.
 */
export function setMarketConnection(previousState, status, label) {
  return {
    ...previousState,
    feedMode: status === "mock" ? "mock" : previousState.feedMode,
    connectionStatus: status,
    connectionLabel: label,
    isHydrating: status === "mock" ? false : previousState.isHydrating,
  };
}

/**
 * Binance markPrice 이벤트를 반영해 state를 갱신한다.
 *
 * 실행 순서 D-1:
 * 가격 headline은 markPrice 이벤트로 가장 먼저 업데이트된다.
 * 차트 자체는 trade 이벤트를 중심으로 1초 캔들로 집계하므로,
 * 여기서는 차트보다 가격 텍스트 쪽 갱신이 중심이다.
 */
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
    isHydrating: false,
    error: null,
    historyReady: true,
  };
}

/**
 * Binance aggTrade 이벤트를 반영해 state를 갱신한다.
 *
 * 실행 순서 D-2:
 * - trade 1건을 계약 히스토리에 반영
 * - 해당 초의 OHLC 캔들 갱신
 * - 누적 volume 갱신
 */
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
    isHydrating: false,
    error: null,
    historyReady: true,
  };
}

/**
 * 캔들 배열을 실제 SVG 렌더에 쓰기 좋은 좌표 정보로 변환한다.
 *
 * 실행 순서 E:
 * App의 useMemo 안에서 호출되어 "그릴 준비가 끝난 차트 데이터"를 만든다.
 */
export function buildChartMeta(candles, width, height, movingAveragePeriod = null) {
  if (!candles.length) {
    return {
      min: 0,
      max: 0,
      axisStep: 1,
      axisWidth: 110,
      plotWidth: round(width - 110, 2),
      plotHeight: round(height - 28, 2),
      candleWidth: 0,
      axisTicks: [],
      movingAverage: [],
      candles: [],
    };
  }

  const axisWidth = 110;
  const topPadding = 14;
  const bottomPadding = 14;
  const plotWidth = Math.max(width - axisWidth, 1);
  const plotHeight = Math.max(height - topPadding - bottomPadding, 1);
  const lows = candles.map((candle) => candle.low);
  const highs = candles.map((candle) => candle.high);
  const dataMin = Math.min(...lows);
  const dataMax = Math.max(...highs);
  const dataSpread = Math.max(dataMax - dataMin, 1);
  const paddedMin = dataMin - dataSpread * 0.08;
  const paddedMax = dataMax + dataSpread * 0.08;
  const axisTickCount = 5;
  const niceStep = getNiceStep((paddedMax - paddedMin) / Math.max(axisTickCount - 1, 1));
  const min = Math.floor(paddedMin / niceStep) * niceStep;
  const max = Math.ceil(paddedMax / niceStep) * niceStep;
  const spread = Math.max(max - min, niceStep);
  const step = plotWidth / Math.max(candles.length, 1);
  const candleWidth = Math.max(step * 0.62, 2);
  const toY = (price) => round(topPadding + plotHeight - ((price - min) / spread) * plotHeight, 2);
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
      color: rising ? "#b91c1c" : "#1d4ed8",
      rising,
    };
  });

  const axisTicks = Array.from({ length: axisTickCount }, (_, index) => {
    const value = round(max - niceStep * index, 1);

    return {
      key: `axis-${index}`,
      value,
      y: toY(value),
    };
  });

  const movingAverage = Number.isInteger(movingAveragePeriod) && movingAveragePeriod >= 5 && movingAveragePeriod <= 20
    ? buildMovingAveragePoints(candles, movingAveragePeriod, step, toY)
    : [];

  return {
    min,
    max,
    axisStep: niceStep,
    axisWidth,
    plotWidth: round(plotWidth, 2),
    plotHeight: round(plotHeight, 2),
    candleWidth: round(candleWidth, 2),
    axisTicks,
    movingAverage,
    candles: candleShapes,
  };
}

/**
 * 오른쪽 세로축에 표시할 눈금 라벨 포맷이다.
 *
 * "정확한 체결가"가 아니라 "읽기 쉬운 눈금"을 보여주는 목적이므로
 * step이 1 이상이면 정수 단위로, 그보다 작으면 소수 한 자리까지 표시한다.
 */
export function formatAxisTick(value, step) {
  const digits = step >= 1 ? 0 : 1;

  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * 가격 표시용 포맷 함수 모음이다.
 *
 * 초심자에게 보여주기 위해 분리했다.
 * "데이터 계산"과 "화면 포맷"은 역할이 다르다.
 */
export function formatPrice(value) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * 등락률처럼 부호가 필요한 퍼센트 값 포맷 함수다.
 */
export function formatSignedPercent(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * 가격 변화량처럼 부호가 필요한 가격 값 포맷 함수다.
 */
export function formatSignedPrice(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatPrice(value)}`;
}

/**
 * 큰 숫자를 천 단위 구분 기호와 함께 보여준다.
 */
export function formatCompactNumber(value) {
  return value.toLocaleString("en-US");
}

/**
 * timestamp를 화면에 보여줄 시각 문자열로 바꾼다.
 */
export function formatClock(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);
}

/**
 * BTC 수량처럼 소수 셋째 자리까지 보여줄 값 포맷 함수다.
 */
export function formatAmount(value) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
