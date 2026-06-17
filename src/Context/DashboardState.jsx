import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Context from "./DashboardContext";
import { getStoredSettings } from "../config/appSettings";
import { ALL_MODEL_LABELS, MODEL_1_LABELS } from "../config/modelLabels";

const OBJECT_LABELS = MODEL_1_LABELS;

export { ALL_MODEL_LABELS, MODEL_1_LABELS, OBJECT_LABELS };

const emptyObjectRows = OBJECT_LABELS.map((objectName) => ({
  objectName,
  frameCount: 0,
  totalCount: 0,
  timestamp: null,
  status: "Inactive",
  lastSeen: null,
}));

const RUN_MODE_STORAGE_KEY = "softcityRunMode";
const DEMO_PACKET_EVERY_MS = 5000;

function getStoredRunMode() {
  try {
    return window.localStorage.getItem(RUN_MODE_STORAGE_KEY) === "demo" ? "demo" : "real";
  } catch (error) {
    return "real";
  }
}

function normalizeStat(stat) {
  return {
    objectName: stat.objectName,
    frameCount: Number(stat.frameCount || 0),
    totalCount: Number(stat.totalCount || 0),
    timestamp: stat.timestamp || new Date().toISOString(),
    status: stat.status || (Number(stat.frameCount || 0) > 0 ? "Active" : "Inactive"),
    lastSeen:
      Number(stat.frameCount || 0) > 0
        ? new Date().toISOString()
        : stat.lastSeen || stat.timestamp || null,
  };
}

const DashboardState = ({ children }) => {
  const [mode, setMode] = useState("light-mode");
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [objectData, setObjectData] = useState(emptyObjectRows);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [cameraLastSeen, setCameraLastSeen] = useState(null);
  const [cameraMemory, setCameraMemory] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [detectionHistory, setDetectionHistory] = useState([]);
  const [transportMetrics, setTransportMetrics] = useState({
    byProtocol: { mqtt: null },
    current: null,
  });
  const [appRunMode, setAppRunMode] = useState(() => getStoredRunMode());
  const [latestPacket, setLatestPacket] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [backgroundColor, setBackgroundColor] = useState("#f6f8fb");
  const [appSettings, setAppSettings] = useState(() => getStoredSettings());
  const reconnectTimer = useRef(null);
  const objectDataRef = useRef(emptyObjectRows);
  const appSettingsRef = useRef(appSettings);

  const websocketUrl = useMemo(
    () => `ws://${appSettings.backendHost || "localhost"}:${appSettings.websocketPort || "8080"}`,
    [appSettings.backendHost, appSettings.websocketPort],
  );

  const addEvent = useCallback((type, message, details = {}) => {
    setEventLog((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        type,
        message,
        details,
      },
      ...current,
    ].slice(0, 80));
  }, []);

  const applyStatistics = useCallback((statistics, metadata = {}) => {
    if (!Array.isArray(statistics)) {
      return;
    }

    if (metadata.cameraLastSeen) {
      setCameraLastSeen(metadata.cameraLastSeen);
    }

    if (metadata.cameraMemory) {
      setCameraMemory(metadata.cameraMemory);
    }

    if (metadata.transport) {
      setTransportMetrics((previous) => ({
        byProtocol: {
          ...previous.byProtocol,
          ...(metadata.transport.byProtocol || {}),
        },
        current: metadata.transport.current || previous.current,
      }));
    }

    setObjectData((previousRows) => {
      const rowMap = new Map(previousRows.map((row) => [row.objectName, row]));

      statistics.forEach((stat) => {
        if (!stat.objectName || !ALL_MODEL_LABELS.includes(stat.objectName)) {
          return;
        }

        const normalized = normalizeStat(stat);
        const previous = rowMap.get(normalized.objectName);

        rowMap.set(normalized.objectName, {
          ...previous,
          ...normalized,
          lastSeen:
            normalized.frameCount > 0
              ? normalized.lastSeen
              : previous?.lastSeen || normalized.lastSeen,
        });
      });

      const orderedRows = ALL_MODEL_LABELS.map((label) => rowMap.get(label)).filter(Boolean);

      const timestamp = new Date();
      const activeDetections = orderedRows.reduce(
        (sum, item) => sum + Number(item.frameCount || 0),
        0,
      );
      const totalDetections = orderedRows.reduce(
        (sum, item) => sum + Number(item.totalCount || 0),
        0,
      );
      const classTotals = orderedRows.reduce((snapshot, item) => {
        snapshot[item.objectName] = Number(item.totalCount || 0);
        return snapshot;
      }, {});
      const mqttMetric = metadata.transport?.byProtocol?.mqtt;
      const mqttLatencyMs =
        mqttMetric?.bridgeLatencyMs ??
        mqttMetric?.publishDurationMs ??
        metadata.transport?.current?.publishDurationMs ??
        null;

      setLastUpdate(timestamp);
      setDetectionHistory((history) => [
        ...history.slice(-23),
        {
          label: timestamp.toLocaleTimeString([], {
            minute: "2-digit",
            second: "2-digit",
          }),
          activeDetections,
          mqttLatencyMs,
          classTotals,
          totalDetections,
          transport: metadata.transport?.current?.protocol || "unknown",
        },
      ]);

      return orderedRows;
    });

    addEvent("packet", `${metadata.transport?.current?.protocol?.toUpperCase() || "Data"} packet applied`, {
      classes: statistics.length,
      topic: metadata.transport?.current?.topic || appSettings.mqttTopic,
    });
  }, [addEvent, appSettings.mqttTopic]);

  const resetDashboardData = useCallback(() => {
    objectDataRef.current = emptyObjectRows;
    setObjectData(emptyObjectRows);
    setDetectionHistory([]);
    setLastUpdate(null);
    setCameraLastSeen(null);
    setCameraMemory(null);
    setTransportMetrics({
      byProtocol: { mqtt: null },
      current: null,
    });
    setLatestPacket(null);
    addEvent("mode", "Real mode selected. Home data reset and waiting for camera MQTT packets.");
  }, [addEvent]);

  const changeAppRunMode = useCallback(
    (nextMode) => {
      const normalizedMode = nextMode === "demo" ? "demo" : "real";

      setAppRunMode(normalizedMode);
      window.localStorage.setItem(RUN_MODE_STORAGE_KEY, normalizedMode);

      if (normalizedMode === "real") {
        resetDashboardData();
      } else {
        addEvent("mode", "Demo mode selected. React data generator is active.");
      }

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "app_mode_command",
            mode: normalizedMode,
          }),
        );
      }
    },
    [addEvent, resetDashboardData, socket],
  );

  const changeThemeMode = useCallback((nextMode) => {
    const normalizedMode = nextMode === "dark-mode" ? "dark-mode" : "light-mode";
    setMode(normalizedMode);
    addEvent("ui", `${normalizedMode === "dark-mode" ? "Dark" : "Light"} mode selected.`);
  }, [addEvent]);

  useEffect(() => {
    let ws;
    let closedByCleanup = false;

    const connectWebSocket = () => {
      setConnectionStatus("connecting");
      ws = new WebSocket(websocketUrl);

      ws.onopen = () => {
        setSocket(ws);
        setConnectionStatus("connected");
        addEvent("connection", "WebSocket bridge connected.", { url: websocketUrl });
        ws.send(
          JSON.stringify({
            type: "settings_update",
            settings: appSettingsRef.current,
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLatestPacket({
            receivedAt: new Date().toISOString(),
            raw: message,
          });

          const activeObjectTopic = appSettings.mqttTopic || "softcity/hassaan/nicla-vision/statistics";

          if (
            message.topic === activeObjectTopic &&
            message.data?.statistics
          ) {
            applyStatistics(message.data.statistics, {
              cameraConnected: message.data.cameraConnected,
              cameraLastSeen: message.data.cameraLastSeen,
              cameraMemory: message.data.cameraMemory,
              transport: message.data.transport,
            });
          } else if (message.type === "mqtt_cli") {
            addEvent("cli", `CLI command response: ${message.data?.command || "mqtt"}`, {
              lines: message.data?.lines || [],
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          addEvent("error", `WebSocket parse error: ${error.message}`);
        }
      };

      ws.onclose = () => {
        setSocket(null);
        setConnectionStatus("disconnected");
        addEvent("connection", "WebSocket bridge disconnected.");

        if (!closedByCleanup) {
          reconnectTimer.current = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = () => {
        setConnectionStatus("error");
        addEvent("error", "WebSocket bridge error.");
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      closedByCleanup = true;
      window.clearTimeout(reconnectTimer.current);
      ws?.close();
    };
  }, [addEvent, appSettings.mqttTopic, applyStatistics, websocketUrl]);

  useEffect(() => {
    const refreshSettings = () => setAppSettings(getStoredSettings());

    window.addEventListener("storage", refreshSettings);
    window.addEventListener("softcity-settings-updated", refreshSettings);

    return () => {
      window.removeEventListener("storage", refreshSettings);
      window.removeEventListener("softcity-settings-updated", refreshSettings);
    };
  }, []);

  useEffect(() => {
    objectDataRef.current = objectData;
  }, [objectData]);

  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  useEffect(() => {
    if (appRunMode !== "demo") {
      return undefined;
    }

    const publishReactPacket = () => {
      const timestamp = new Date().toISOString();
      const previousRows = new Map(
        objectDataRef.current.map((row) => [row.objectName, row]),
      );
      const statistics = OBJECT_LABELS.map((objectName, index) => {
        const previous = previousRows.get(objectName);
        const frameCount = Math.floor(Math.random() * 5);
        const totalCount =
          Number(previous?.totalCount || 0) +
          frameCount +
          Math.floor(Math.random() * 3);

        return {
          objectName,
          frameCount,
          totalCount,
          timestamp,
          status: frameCount > 0 ? "Active" : "Inactive",
          confidence: Number((0.82 + Math.random() * 0.17).toFixed(3)),
          sequence: index + 1,
          lastSeen: frameCount > 0 ? timestamp : previous?.lastSeen || null,
        };
      });

      applyStatistics(statistics, {
        cameraLastSeen: timestamp,
        transport: {
          current: {
            protocol: "react",
            bridgeLatencyMs: 0,
            publishDurationMs: 0,
            receivedAt: timestamp,
            topic: "react-generated/statistics",
          },
          byProtocol: {
            react: {
              protocol: "react",
              bridgeLatencyMs: 0,
              publishDurationMs: 0,
              receivedAt: timestamp,
              topic: "react-generated/statistics",
            },
          },
        },
        cameraMemory: {
          ramFreeBytes: Math.round(344000 + Math.random() * 14000),
          ramTotalBytes: 512000,
          romUsedBytes: Math.round(1260000 + Math.random() * 35000),
          romTotalBytes: 2048000,
        },
      });
      setLatestPacket({
        receivedAt: timestamp,
        raw: {
          topic: "react-generated/statistics",
          type: "object_detection",
          data: { statistics },
        },
      });
    };

    publishReactPacket();
    const interval = window.setInterval(publishReactPacket, DEMO_PACKET_EVERY_MS);

    return () => window.clearInterval(interval);
  }, [appRunMode, applyStatistics]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  const cameraFeedConnected = useMemo(() => {
    if (!cameraLastSeen) {
      return false;
    }

    return now - new Date(cameraLastSeen).getTime() < 15000;
  }, [cameraLastSeen, now]);

  const feedStatus = useMemo(() => {
    if (connectionStatus !== "connected") {
      return connectionStatus;
    }

    return cameraFeedConnected ? "live" : "waiting";
  }, [cameraFeedConnected, connectionStatus]);

  const detectionStats = useMemo(() => {
    const totalDetections = objectData.reduce(
      (sum, item) => sum + Number(item.totalCount || 0),
      0,
    );
    const activeDetections = objectData.reduce(
      (sum, item) => sum + Number(item.frameCount || 0),
      0,
    );
    const activeTypes = objectData.filter((item) => item.frameCount > 0).length;
    const trackedTypes = objectData.length;
    const topObject = objectData.reduce((top, item) => {
      if (!top) {
        return item;
      }

      return Number(item.totalCount || 0) > Number(top.totalCount || 0)
        ? item
        : top;
    }, null);

    return {
      activeDetections,
      activeTypes,
      totalDetections,
      trackedTypes,
      topObject,
    };
  }, [objectData]);

  const alerts = useMemo(() => {
    const alertRows = [];
    const latestLatency =
      transportMetrics.current?.bridgeLatencyMs ??
      transportMetrics.current?.publishDurationMs;

    if (connectionStatus !== "connected") {
      alertRows.push({
        level: "critical",
        title: "Bridge offline",
        message: "React is not connected to the Node WebSocket bridge.",
      });
    }

    if (appRunMode === "real" && !cameraFeedConnected) {
      alertRows.push({
        level: "warning",
        title: "Waiting for camera packets",
        message: "Real mode is active and no recent MQTT packet has arrived.",
      });
    }

    if (Number(latestLatency || 0) > 100) {
      alertRows.push({
        level: "warning",
        title: "High latency",
        message: `Latest transport latency is ${Number(latestLatency).toFixed(1)} ms.`,
      });
    }

    if (detectionStats.activeDetections > 12) {
      alertRows.push({
        level: "info",
        title: "High frame activity",
        message: `${detectionStats.activeDetections} detections are active in the current frame.`,
      });
    }

    return alertRows;
  }, [appRunMode, cameraFeedConnected, connectionStatus, detectionStats.activeDetections, transportMetrics]);

  return (
    <Context.Provider
      value={{
        applyStatistics,
        appSettings,
        appRunMode,
        alerts,
        backgroundColor,
        cameraFeedConnected,
        cameraLastSeen,
        cameraMemory,
        changeAppRunMode,
        changeThemeMode,
        connectionStatus,
        detectionHistory,
        detectionStats,
        eventLog,
        lastUpdate,
        feedStatus,
        latestPacket,
        mode,
        objectData,
        setBackgroundColor,
        setAppSettings,
        setMode,
        socket,
        transportMetrics,
        websocketUrl,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export default DashboardState;
