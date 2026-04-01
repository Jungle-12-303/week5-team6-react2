// 소켓이 끊긴 뒤 다시 연결을 시도하기까지 기다리는 시간이다.
const RECONNECT_DELAY_MS = 2000;

// 일정 시간 안에 데이터가 전혀 안 오면 live 피드가 죽었다고 판단하는 기준 시간이다.
const STALE_TIMEOUT_MS = 6000;

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
