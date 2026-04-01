const RECONNECT_DELAY_MS = 2000;
const STALE_TIMEOUT_MS = 6000;

function buildStreamUrl(symbol) {
  const lowerSymbol = symbol.toLowerCase();
  return `wss://fstream.binance.com/stream?streams=${lowerSymbol}@markPrice@1s/${lowerSymbol}@aggTrade`;
}

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

  const scheduleReconnect = () => {
    if (closedByUser) {
      return;
    }

    onStatusChange?.("reconnecting");
    reconnectTimer = window.setTimeout(() => {
      openSocket();
    }, RECONNECT_DELAY_MS);
  };

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

  return () => {
    closedByUser = true;
    clearTimers();
    socket?.close();
  };
}
