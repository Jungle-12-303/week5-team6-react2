// 소켓이 끊긴 뒤 다시 연결을 시도하기까지 기다리는 시간이다.
const RECONNECT_DELAY_MS = 2000;

// 일정 시간 안에 데이터가 전혀 안 오면 live 피드가 죽었다고 판단하는 기준 시간이다.
const STALE_TIMEOUT_MS = 6000;

// 차트 시작 시 최근 몇 초의 거래를 REST로 미리 불러올지 결정한다.
const BACKFILL_WINDOW_MS = 150 * 1000;

// aggTrade REST는 한 번에 최대 1000개만 주므로, backfill 구간을 작은 창으로 나눠서 가져온다.
const AGG_TRADE_SLICE_MS = 15 * 1000;

// Binance Futures 공개 REST endpoint다.
const REST_BASE_URL = "https://fapi.binance.com";

/**
 * 심볼명을 Binance Futures combined stream URL로 변환한다.
 *
 * 현재는:
 * - markPrice@1s
 * - aggTrade
 * 두 스트림을 동시에 묶어서 사용한다.
 */
function buildStreamUrl(symbol) {
  const lowerSymbol = symbol.toLowerCase();
  return `wss://fstream.binance.com/stream?streams=${lowerSymbol}@markPrice@1s/${lowerSymbol}@aggTrade`;
}

/**
 * 심볼과 interval을 Binance Futures kline stream URL로 변환한다.
 */
function buildKlineStreamUrl(symbol, interval) {
  const lowerSymbol = symbol.toLowerCase();
  return `wss://fstream.binance.com/ws/${lowerSymbol}@kline_${interval}`;
}

/**
 * 최근 aggTrade를 REST로 가져온다.
 *
 * 목적:
 * - 페이지 진입 직후 과거 150초 정도의 실제 거래 흐름을 먼저 그리기
 * - 그 뒤 WebSocket live 이벤트를 이어 붙이기
 */
export async function fetchRecentAggTrades(symbol = "btcusdt", now = Date.now()) {
  if (typeof fetch === "undefined") {
    throw new Error("Fetch API is not available in this environment.");
  }

  const symbolName = symbol.toUpperCase();
  const ranges = [];

  for (let sliceEnd = now; sliceEnd > now - BACKFILL_WINDOW_MS; sliceEnd -= AGG_TRADE_SLICE_MS) {
    const sliceStart = Math.max(now - BACKFILL_WINDOW_MS, sliceEnd - AGG_TRADE_SLICE_MS + 1);
    ranges.push([sliceStart, sliceEnd]);
  }

  const responses = await Promise.all(
    ranges.map(async ([startTime, endTime]) => {
      const url = new URL("/fapi/v1/aggTrades", REST_BASE_URL);
      url.searchParams.set("symbol", symbolName);
      url.searchParams.set("startTime", String(startTime));
      url.searchParams.set("endTime", String(endTime));
      url.searchParams.set("limit", "1000");

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch aggTrades: ${response.status}`);
      }

      const trades = await response.json();
      return Array.isArray(trades) ? trades : [];
    }),
  );

  const dedupedTrades = new Map();

  responses.flat().forEach((trade) => {
    dedupedTrades.set(String(trade.a), trade);
  });

  return [...dedupedTrades.values()].sort((left, right) => (Number(left.T) || 0) - (Number(right.T) || 0));
}

/**
 * 최근 24시간 가격 통계를 REST로 가져온다.
 */
export async function fetch24hrTicker(symbol = "btcusdt") {
  if (typeof fetch === "undefined") {
    throw new Error("Fetch API is not available in this environment.");
  }

  const url = new URL("/fapi/v1/ticker/24hr", REST_BASE_URL);
  url.searchParams.set("symbol", symbol.toUpperCase());

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch 24hr ticker: ${response.status}`);
  }

  const ticker = await response.json();
  return ticker && typeof ticker === "object" ? ticker : null;
}

/**
 * 최근 kline 데이터를 REST로 가져온다.
 *
 * 차트 interval 선택 시 1분봉/5분봉 초기 화면을 채울 때 사용한다.
 */
export async function fetchRecentKlines(symbol = "btcusdt", interval = "1m", limit = 150) {
  if (typeof fetch === "undefined") {
    throw new Error("Fetch API is not available in this environment.");
  }

  const url = new URL("/fapi/v1/klines", REST_BASE_URL);
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch klines: ${response.status}`);
  }

  const klines = await response.json();
  return Array.isArray(klines) ? klines : [];
}

/**
 * Binance 공개 WebSocket market feed를 연결하는 함수다.
 *
 * 인자:
 * - symbol: 연결할 심볼
 * - onEvent: 실시간 payload를 App에 전달
 * - onStatusChange: 연결 상태를 App에 전달
 * - onFallback: live 연결 실패 시 mock 모드로 전환하도록 알림
 *
 * 반환값:
 * - disconnect 함수
 */
export function connectBinanceFeed({
  symbol = "btcusdt",
  onEvent,
  onStatusChange,
  onFallback,
}) {
  if (typeof WebSocket === "undefined") {
    onFallback?.("WebSocket is not available in this environment.");
    return () => {};
  }

  let socket = null;
  let reconnectTimer = null;
  let staleTimer = null;
  let closedByUser = false;
  let receivedData = false;

  /**
   * reconnect / stale 관련 타이머를 모두 정리한다.
   */
  const clearTimers = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (staleTimer) {
      window.clearTimeout(staleTimer);
      staleTimer = null;
    }
  };

  /**
   * 데이터가 한동안 안 들어오면 fallback을 트리거하는 감시 타이머를 건다.
   *
   * 실행 순서 F-1:
   * 연결을 시도할 때, 그리고 메시지를 받을 때마다 다시 설정한다.
   */
  const armStaleTimer = () => {
    if (staleTimer) {
      window.clearTimeout(staleTimer);
    }

    staleTimer = window.setTimeout(() => {
      if (!receivedData) {
        onFallback?.("No live data arrived from Binance in time. Falling back to mock feed.");
        socket?.close();
      }
    }, STALE_TIMEOUT_MS);
  };

  /**
   * 소켓이 정상 종료가 아닌 경우 잠시 후 재연결을 예약한다.
   */
  const scheduleReconnect = () => {
    if (closedByUser) {
      return;
    }

    onStatusChange?.("reconnecting");
    reconnectTimer = window.setTimeout(() => {
      openSocket();
    }, RECONNECT_DELAY_MS);
  };

  /**
   * WebSocket raw message를 파싱해서 App이 이해할 수 있는 payload로 넘긴다.
   *
   * 실행 순서 F-2:
   * Binance가 보낸 JSON -> parsed.data -> App의 setMarket 흐름으로 전달
   */
  const handleMessage = (rawMessage) => {
    const parsed = JSON.parse(rawMessage);
    const payload = parsed.data ?? parsed;

    receivedData = true;
    onStatusChange?.("live");
    armStaleTimer();

    if (payload?.e === "markPriceUpdate" || payload?.e === "aggTrade") {
      onEvent?.(payload);
    }
  };

  /**
   * 실제 WebSocket 연결을 여는 함수다.
   *
   * 실행 순서 F:
   * App.useEffect 안에서 connectBinanceFeed()가 호출되면 내부적으로 여기까지 들어온다.
   */
  function openSocket() {
    clearTimers();
    receivedData = false;
    onStatusChange?.("connecting");

    socket = new WebSocket(buildStreamUrl(symbol));
    armStaleTimer();

    socket.addEventListener("open", () => {
      onStatusChange?.("connected");
    });

    socket.addEventListener("message", (event) => {
      try {
        handleMessage(event.data);
      } catch (error) {
        console.error("Failed to process Binance payload", error);
      }
    });

    socket.addEventListener("error", () => {
      onFallback?.("Binance WebSocket connection failed. Falling back to mock feed.");
    });

    socket.addEventListener("close", () => {
      clearTimers();

      if (!receivedData) {
        onFallback?.("Binance stream closed before receiving live data. Falling back to mock feed.");
        return;
      }

      scheduleReconnect();
    });
  }

  openSocket();

  /**
   * App가 unmount될 때 호출할 정리 함수다.
   */
  return () => {
    closedByUser = true;
    clearTimers();
    socket?.close();
  };
}

/**
 * Binance 공식 kline WebSocket feed를 연결한다.
 *
 * 차트 전용 feed이며, 가격/체결 feed와 분리해서 사용한다.
 */
export function connectBinanceKlineFeed({
  symbol = "btcusdt",
  interval = "1m",
  onEvent,
  onStatusChange,
}) {
  if (typeof WebSocket === "undefined") {
    onStatusChange?.("unavailable");
    return () => {};
  }

  let socket = null;
  let reconnectTimer = null;
  let closedByUser = false;

  const clearReconnect = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closedByUser) {
      return;
    }

    onStatusChange?.("reconnecting");
    reconnectTimer = window.setTimeout(() => {
      openSocket();
    }, RECONNECT_DELAY_MS);
  };

  function openSocket() {
    clearReconnect();
    onStatusChange?.("connecting");
    socket = new WebSocket(buildKlineStreamUrl(symbol, interval));

    socket.addEventListener("open", () => {
      onStatusChange?.("connected");
    });

    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onStatusChange?.("live");

        if (parsed?.e === "kline" && parsed?.k?.i === interval) {
          onEvent?.(parsed);
        }
      } catch (error) {
        console.error("Failed to process Binance kline payload", error);
      }
    });

    socket.addEventListener("error", () => {
      onStatusChange?.("error");
    });

    socket.addEventListener("close", () => {
      scheduleReconnect();
    });
  }

  openSocket();

  return () => {
    closedByUser = true;
    clearReconnect();
    socket?.close();
  };
}
