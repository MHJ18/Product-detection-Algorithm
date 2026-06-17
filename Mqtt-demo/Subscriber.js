const mqtt = require("mqtt");
const WebSocket = require("ws");

const WS_PORT = Number(process.env.WS_PORT || 8080);
let MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://test.mosquitto.org:1883";
const ENABLE_MQTT = process.env.ENABLE_MQTT !== "false";
let OBJECT_TOPIC = process.env.MQTT_TOPIC || "softcity/hassaan/nicla-vision/statistics";
const GEAR_LABELS = [
  "LargeGreenGear",
  "LargeYellowGear",
  "GreenStar",
  "SmallWheel",
  "SmallHelicalGearYellow",
  "SmallRoundGearYellow",
];
const KNOWN_OBJECT_LABELS = GEAR_LABELS;
const TOPIC_DISCOVERY_MS = 3500;
const TOPIC_DISCOVERY_LIMIT = 40;

const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`WS server running on ws://localhost:${WS_PORT}`);

const totals = {};
let lastCameraUpdate = null;
let mqttClient = null;
let mqttConnected = false;
let mqttLastError = null;
let mqttLastConnectedAt = null;
let mqttReconnectCount = 0;
let appRunMode = "real";
const mqttSysStats = {};
const transportMetrics = {
  mqtt: null,
};

function clearMqttSysStats() {
  Object.keys(mqttSysStats).forEach((topic) => {
    delete mqttSysStats[topic];
  });
}

function resetRuntimeCounts() {
  Object.keys(totals).forEach((key) => {
    delete totals[key];
  });
  transportMetrics.mqtt = null;
  lastCameraUpdate = null;
}

function getCameraFeedState() {
  return {
    cameraConnected:
      lastCameraUpdate !== null && Date.now() - lastCameraUpdate.getTime() < 15000,
    cameraLastSeen: lastCameraUpdate ? lastCameraUpdate.toISOString() : null,
  };
}

function toIsoTimestamp(timestamp) {
  if (!timestamp) {
    return new Date().toISOString();
  }

  if (typeof timestamp === "number") {
    const value = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
    return new Date(value).toISOString();
  }

  return timestamp;
}

function buildStatisticsFromCounts(frameCounts = {}, totalCounts = {}, timestamp) {
  const objectNames = new Set([
    ...KNOWN_OBJECT_LABELS,
    ...Object.keys(frameCounts || {}),
    ...Object.keys(totalCounts || {}),
    ...Object.keys(totals),
  ]);

  return Array.from(objectNames).map((objectName) => {
    const frameCount = Number(frameCounts[objectName] || 0);
    const totalCount =
      totalCounts[objectName] !== undefined
        ? Number(totalCounts[objectName] || 0)
        : Number(totals[objectName] || 0);

    totals[objectName] = totalCount;

    return {
      objectName,
      frameCount,
      totalCount,
      timestamp,
      status: frameCount > 0 ? "Active" : "Inactive",
    };
  });
}

function getTransportMeta(source, payload, receivedAtMs) {
  const protocol = String(payload.transport || source || "unknown").toLowerCase();
  const sentAtMs = Number(payload.sent_at_ms || payload.transport_sent_at_ms || 0);
  const bridgeLatencyMs = sentAtMs > 0 ? Math.max(0, receivedAtMs - sentAtMs) : null;
  const publishDurationMs =
    payload.publish_duration_ms !== undefined
      ? Number(payload.publish_duration_ms)
      : payload.transport_duration_ms !== undefined
        ? Number(payload.transport_duration_ms)
        : null;

  const metric = {
    protocol,
    bridgeLatencyMs,
    publishDurationMs,
    receivedAt: new Date(receivedAtMs).toISOString(),
    topic: payload.topic || OBJECT_TOPIC,
  };

  if (protocol === "mqtt") {
    transportMetrics[protocol] = metric;
  }

  return {
    current: metric,
    byProtocol: { ...transportMetrics },
  };
}

function firstNumber(...values) {
  const match = values.find((value) => value !== undefined && value !== null && value !== "");
  return match === undefined ? null : Number(match);
}

function getCameraMemoryMeta(payload = {}) {
  const memory = payload.cameraMemory || payload.memory || payload.camera_memory || {};
  const ramFreeBytes = firstNumber(
    memory.ramFreeBytes,
    memory.ram_free_bytes,
    memory.freeHeapBytes,
    memory.free_heap_bytes,
    memory.freeHeap,
    memory.free_heap,
    payload.ramFreeBytes,
    payload.ram_free_bytes,
    payload.freeHeapBytes,
    payload.free_heap_bytes,
    payload.freeHeap,
    payload.free_heap,
  );
  const ramTotalBytes = firstNumber(
    memory.ramTotalBytes,
    memory.ram_total_bytes,
    payload.ramTotalBytes,
    payload.ram_total_bytes,
  );
  const romFreeBytes = firstNumber(
    memory.romFreeBytes,
    memory.rom_free_bytes,
    memory.flashFreeBytes,
    memory.flash_free_bytes,
    payload.romFreeBytes,
    payload.rom_free_bytes,
    payload.flashFreeBytes,
    payload.flash_free_bytes,
  );
  const romUsedBytes = firstNumber(
    memory.romUsedBytes,
    memory.rom_used_bytes,
    memory.flashUsedBytes,
    memory.flash_used_bytes,
    payload.romUsedBytes,
    payload.rom_used_bytes,
    payload.flashUsedBytes,
    payload.flash_used_bytes,
  );
  const romTotalBytes = firstNumber(
    memory.romTotalBytes,
    memory.rom_total_bytes,
    memory.flashTotalBytes,
    memory.flash_total_bytes,
    payload.romTotalBytes,
    payload.rom_total_bytes,
    payload.flashTotalBytes,
    payload.flash_total_bytes,
  );

  if (
    [ramFreeBytes, ramTotalBytes, romFreeBytes, romUsedBytes, romTotalBytes]
      .every((value) => value === null || Number.isNaN(value))
  ) {
    return null;
  }

  return {
    ramFreeBytes: Number.isNaN(ramFreeBytes) ? null : ramFreeBytes,
    ramTotalBytes: Number.isNaN(ramTotalBytes) ? null : ramTotalBytes,
    romFreeBytes: Number.isNaN(romFreeBytes) ? null : romFreeBytes,
    romUsedBytes: Number.isNaN(romUsedBytes) ? null : romUsedBytes,
    romTotalBytes: Number.isNaN(romTotalBytes) ? null : romTotalBytes,
    capturedAt: payload.timestamp ? toIsoTimestamp(payload.timestamp) : new Date().toISOString(),
  };
}

function normalizeDetectionPayload(payload, source, receivedAtMs) {
  const timestamp = toIsoTimestamp(payload.timestamp);
  const transport = getTransportMeta(source, payload, receivedAtMs);
  const cameraMemory = getCameraMemoryMeta(payload);

  if (payload.statistics) {
    payload.statistics.forEach((stat) => {
      if (stat.objectName && stat.totalCount !== undefined) {
        totals[stat.objectName] = Number(stat.totalCount || 0);
      }
    });

    return {
      statistics: payload.statistics,
      timestamp: payload.timestamp || timestamp,
      source: payload.source || "object_detection",
      transport,
      cameraMemory,
    };
  }

  if (payload.counts) {
    return {
      statistics: buildStatisticsFromCounts(
        payload.counts.frame || {},
        payload.counts.total || {},
        timestamp,
      ),
      timestamp,
      source: "object_detection",
      transport,
      cameraMemory,
    };
  }

  if (payload.frame || payload.total) {
    return {
      statistics: buildStatisticsFromCounts(payload.frame || {}, payload.total || {}, timestamp),
      timestamp,
      source: "object_detection",
      transport,
      cameraMemory,
    };
  }

  if (payload.event === "detection" && payload.label) {
    const frameCounts = { [payload.label]: 1 };
    const totalCounts = payload.totals || { [payload.label]: payload.pass_count || 0 };

    return {
      statistics: buildStatisticsFromCounts(frameCounts, totalCounts, timestamp),
      timestamp,
      source: "object_detection",
      event: payload.event,
      label: payload.label,
      score: payload.score,
      transport,
      cameraMemory,
    };
  }

  if (payload.event === "reset" && payload.label) {
    totals[payload.label] = 0;

    return {
      statistics: buildStatisticsFromCounts({}, { [payload.label]: 0 }, timestamp),
      timestamp,
      source: "object_detection",
      event: payload.event,
      label: payload.label,
      transport,
      cameraMemory,
    };
  }

  return null;
}

function broadcastObjectDetection(data) {
  const wsPayload = JSON.stringify({
    topic: OBJECT_TOPIC,
    data: {
      ...data,
      ...getCameraFeedState(),
    },
    type: "object_detection",
  });

  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(wsPayload);
    }
  });

  console.log(
    `Object detection statistics forwarded: ${data.statistics.length} objects`,
  );
}

function sendMqttCliResponse(ws, command, lines = [], extra = {}) {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  ws.send(
    JSON.stringify({
      topic: "mqtt/cli",
      type: "mqtt_cli",
      data: {
        command,
        lines,
        brokerUrl: MQTT_BROKER_URL,
        connected: mqttConnected,
        appMode: appRunMode,
        lastError: mqttLastError,
        lastConnectedAt: mqttLastConnectedAt,
        reconnectCount: mqttReconnectCount,
        timestamp: new Date().toISOString(),
        ...extra,
      },
    }),
  );
}

function getMqttStatusLines() {
  const sysTopicCount = Object.keys(mqttSysStats).length;

  return [
    `broker: ${MQTT_BROKER_URL}`,
    `enabled: ${ENABLE_MQTT}`,
    `connected: ${mqttConnected}`,
    `last connected: ${mqttLastConnectedAt || "never"}`,
    `last error: ${mqttLastError || "none"}`,
    `reconnects: ${mqttReconnectCount}`,
    `broker stats cache: ${sysTopicCount} $SYS topics from active broker`,
    `app mode: ${appRunMode}`,
    `topic: ${OBJECT_TOPIC}`,
  ];
}

function getMqttStatsLines() {
  const classLines = KNOWN_OBJECT_LABELS.map((label) => {
    const total = Number(totals[label] || 0);
    return `class/${label}: total=${total}`;
  });
  const statEntries = Object.entries(mqttSysStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30);

  if (statEntries.length === 0) {
    return [
      `active broker: ${MQTT_BROKER_URL}`,
      `broker stats subscription: $SYS/#`,
      ...classLines,
      "No $SYS stats received yet.",
      "Note: Some public MQTT brokers do not expose $SYS stats to anonymous clients.",
    ];
  }

  return [
    `active broker: ${MQTT_BROKER_URL}`,
    `broker stats subscription: $SYS/#`,
    ...classLines,
    ...statEntries.map(([topic, value]) => `${topic}: ${value}`),
  ];
}

function getDefaultDiscoveryTopic() {
  const topicParts = OBJECT_TOPIC.split("/").filter(Boolean);

  if (topicParts.length > 1) {
    return `${topicParts.slice(0, -1).join("/")}/#`;
  }

  return "#";
}

function discoverBrokerTopics(ws, discoveryTopic) {
  if (!mqttClient || !mqttConnected) {
    sendMqttCliResponse(ws, "discover-topics", [
      "Cannot discover topics: MQTT client is not connected.",
    ]);
    return;
  }

  const safeTopic = String(discoveryTopic || getDefaultDiscoveryTopic()).trim();

  if (!safeTopic || safeTopic.includes(" ")) {
    sendMqttCliResponse(ws, "discover-topics", [
      "Invalid discovery topic filter.",
      "Example: discover-topics softcity/hassaan/#",
    ]);
    return;
  }

  const seenTopics = new Set();
  const onDiscoveryMessage = (topic) => {
    if (!topic.startsWith("$SYS/")) {
      seenTopics.add(topic);
    }
  };

  mqttClient.on("message", onDiscoveryMessage);

  mqttClient.subscribe(safeTopic, { qos: 0 }, (error) => {
    if (error) {
      mqttClient.removeListener("message", onDiscoveryMessage);
      sendMqttCliResponse(ws, "discover-topics", [
        `Topic discovery failed: ${error.message}`,
      ]);
      return;
    }

    sendMqttCliResponse(ws, "discover-topics", [
      `Listening for active topics on ${MQTT_BROKER_URL}`,
      `filter: ${safeTopic}`,
      `window: ${TOPIC_DISCOVERY_MS} ms`,
    ]);

    setTimeout(() => {
      mqttClient.removeListener("message", onDiscoveryMessage);
      mqttClient.unsubscribe(safeTopic, () => {});

      const topics = Array.from(seenTopics)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, TOPIC_DISCOVERY_LIMIT);

      sendMqttCliResponse(ws, "discover-topics", [
        `active broker: ${MQTT_BROKER_URL}`,
        `filter: ${safeTopic}`,
        `topics observed: ${seenTopics.size}`,
        ...(topics.length > 0
          ? topics.map((topic) => `topic: ${topic}`)
          : [
              "No application topics published during the discovery window.",
              "Try publish-test, start the camera publisher, or run: discover-all",
            ]),
        seenTopics.size > TOPIC_DISCOVERY_LIMIT
          ? `Showing first ${TOPIC_DISCOVERY_LIMIT} topics only.`
          : "",
      ].filter(Boolean));
    }, TOPIC_DISCOVERY_MS);
  });
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function normalizeRuntimeSettings(settings = {}) {
  const errors = [];
  const nextBrokerUrl = String(settings.mqttBrokerUrl || MQTT_BROKER_URL).trim();
  const nextTopic = String(settings.mqttTopic || OBJECT_TOPIC).trim();

  if (!nextBrokerUrl.startsWith("mqtt://") && !nextBrokerUrl.startsWith("mqtts://")) {
    errors.push("mqttBrokerUrl must start with mqtt:// or mqtts://.");
  }

  if (!nextTopic || nextTopic.includes(" ")) {
    errors.push("mqttTopic is required and cannot contain spaces.");
  }

  return {
    errors,
    settings: {
      mqttBrokerUrl: nextBrokerUrl,
      mqttTopic: nextTopic,
    },
  };
}

function handleSettingsUpdate(ws, settings) {
  const result = normalizeRuntimeSettings(settings);

  if (result.errors.length > 0) {
    sendMqttCliResponse(ws, "settings", [
      "Settings rejected.",
      ...result.errors,
    ], {
      applied: false,
      errors: result.errors,
    });
    return;
  }

  const next = result.settings;
  const changes = [];
  const mqttChanged =
    next.mqttBrokerUrl !== MQTT_BROKER_URL || next.mqttTopic !== OBJECT_TOPIC;

  if (mqttChanged) {
    restartMqttSubscriber(next.mqttBrokerUrl, next.mqttTopic);
    changes.push(`MQTT feed: ${MQTT_BROKER_URL} / ${OBJECT_TOPIC}`);
  }

  sendMqttCliResponse(ws, "settings", [
    changes.length > 0 ? "Runtime settings applied." : "Runtime settings already up to date.",
    ...changes,
    `MQTT feed: ${MQTT_BROKER_URL} / ${OBJECT_TOPIC}`,
  ], {
    applied: true,
    settings: {
      mqttBrokerUrl: MQTT_BROKER_URL,
      mqttTopic: OBJECT_TOPIC,
    },
  });
}

function handleMqttCliCommand(ws, rawCommand) {
  const commandText = String(rawCommand || "status").trim();
  const [baseCommand, ...commandArgs] = commandText.split(/\s+/);
  const command = baseCommand.toLowerCase();

  if (command === "help") {
    sendMqttCliResponse(ws, command, [
      "Available commands:",
      "status - show MQTT connection state",
      "stats - show recent $SYS/# values from the active broker",
      "broker - show active broker and object topic",
      "topics - show subscribed broker topics",
      "discover-topics [filter] - listen briefly for active application topics",
      "discover-all - listen briefly on # for public broker topics",
      "connect - reconnect the MQTT client",
      "publish-test - publish one full-class statistics packet",
      "help - show this help",
    ]);
    return;
  }

  if (command === "status") {
    sendMqttCliResponse(ws, command, getMqttStatusLines());
    return;
  }

  if (command === "stats") {
    sendMqttCliResponse(ws, command, getMqttStatsLines(), {
      stats: mqttSysStats,
    });
    return;
  }

  if (command === "broker") {
    sendMqttCliResponse(ws, command, [
      `active broker: ${MQTT_BROKER_URL}`,
      `object topic: ${OBJECT_TOPIC}`,
      `stats topic: $SYS/#`,
      `connected: ${mqttConnected}`,
      `last connected: ${mqttLastConnectedAt || "never"}`,
    ]);
    return;
  }

  if (command === "topics") {
    sendMqttCliResponse(ws, command, [
      `active broker: ${MQTT_BROKER_URL}`,
      `object feed: ${OBJECT_TOPIC}`,
      "broker stats: $SYS/#",
      `discovery default: ${getDefaultDiscoveryTopic()}`,
      "discover all: #",
      "websocket CLI: mqtt/cli",
    ]);
    return;
  }

  if (command === "discover-topics") {
    discoverBrokerTopics(ws, commandArgs.join(" ") || getDefaultDiscoveryTopic());
    return;
  }

  if (command === "discover-all") {
    discoverBrokerTopics(ws, "#");
    return;
  }

  if (command === "connect") {
    if (!mqttClient) {
      sendMqttCliResponse(ws, command, [
        "MQTT client is not initialized. Restart the bridge or enable MQTT.",
      ]);
      return;
    }

    mqttClient.reconnect();
    sendMqttCliResponse(ws, command, ["Reconnect requested."]);
    return;
  }

  if (command === "publish-test") {
    if (!mqttClient || !mqttConnected) {
      sendMqttCliResponse(ws, command, ["Cannot publish: MQTT client is not connected."]);
      return;
    }

    const nowIso = new Date().toISOString();
    const statistics = KNOWN_OBJECT_LABELS.map((label, index) => {
      const frameCount = Math.floor(Math.random() * 5);
      const increment = frameCount + Math.floor(Math.random() * 3);
      const totalCount = Number(totals[label] || 0) + increment;
      totals[label] = totalCount;

      return {
        objectName: label,
        frameCount,
        totalCount,
        timestamp: nowIso,
        status: frameCount > 0 ? "Active" : "Inactive",
        confidence: Number((0.82 + Math.random() * 0.16).toFixed(3)),
        sequence: index + 1,
        lastSeen: frameCount > 0 ? nowIso : null,
      };
    });

    const payload = {
      mode: appRunMode,
      source: "browser_mqtt_cli",
      statistics,
      transport: "mqtt",
      publish_duration_ms: 0,
      sent_at_ms: Date.now(),
      timestamp: nowIso,
      cameraMemory: {
        ramFreeBytes: randomBetween(342000, 358000),
        ramTotalBytes: 512000,
        romUsedBytes: randomBetween(1260000, 1295000),
        romTotalBytes: 2048000,
      },
    };

    mqttClient.publish(OBJECT_TOPIC, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) {
        sendMqttCliResponse(ws, command, [`Publish failed: ${error.message}`]);
      } else {
        sendMqttCliResponse(ws, command, [
          `Published full-class packet with ${statistics.length} class values.`,
          `mode: ${appRunMode}`,
        ]);
      }
    });
    return;
  }

  sendMqttCliResponse(ws, command, [
    `Unknown command: ${command}`,
    "Type help for available commands.",
  ]);
}

wss.on("connection", (ws) => {
  console.log("Dashboard WebSocket client connected");

  const snapshot = {
    statistics: buildStatisticsFromCounts({}, totals, new Date().toISOString()),
    timestamp: new Date().toISOString(),
    source: "snapshot",
    ...getCameraFeedState(),
  };

  if (snapshot.statistics.length > 0) {
    ws.send(
      JSON.stringify({
        topic: OBJECT_TOPIC,
        data: snapshot,
        type: "object_detection",
      }),
    );
  }

  sendMqttCliResponse(ws, "status", getMqttStatusLines());

  ws.on("message", (message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload?.type === "mqtt_cli_command") {
        handleMqttCliCommand(ws, payload.command);
      } else if (payload?.type === "settings_update") {
        handleSettingsUpdate(ws, payload.settings || {});
      } else if (payload?.type === "app_mode_command") {
        appRunMode = payload.mode === "demo" ? "demo" : "real";
        if (appRunMode === "real") {
          resetRuntimeCounts();
        }
        sendMqttCliResponse(ws, "mode", [`App mode set to ${appRunMode}.`], {
          appMode: appRunMode,
        });
      }
    } catch (error) {
      sendMqttCliResponse(ws, "parse-error", [`Invalid CLI command payload: ${error.message}`]);
    }
  });
});

function handleIncomingPayload(source, payload) {
  const receivedAtMs = Date.now();
  const normalized = normalizeDetectionPayload(payload, source, receivedAtMs);

  if (!normalized || !normalized.statistics?.length) {
    console.log(`${source}: ignored payload`, payload);
    return;
  }

  const metric = normalized.transport?.current;
  const timing =
    metric?.bridgeLatencyMs !== null
      ? `bridge latency ${metric.bridgeLatencyMs.toFixed(1)} ms`
      : "bridge latency unavailable";

  console.log(`${source}: received object detection payload (${timing})`, payload);
  lastCameraUpdate = new Date();
  broadcastObjectDetection(normalized);
}

function restartMqttSubscriber(nextBrokerUrl, nextTopic) {
  MQTT_BROKER_URL = nextBrokerUrl;
  OBJECT_TOPIC = nextTopic;

  if (mqttClient) {
    mqttClient.removeAllListeners();
    mqttClient.end(true);
    mqttClient = null;
  }

  mqttConnected = false;
  mqttLastError = null;
  mqttLastConnectedAt = null;
  clearMqttSysStats();
  startMqttSubscriber();
}

function startMqttSubscriber() {
  if (!ENABLE_MQTT) {
    console.log("MQTT subscriber disabled. Set ENABLE_MQTT=true to use MQTT input.");
    return;
  }

  if (mqttClient) {
    return;
  }

  const client = mqtt.connect(MQTT_BROKER_URL, {
    connectTimeout: 3000,
    reconnectPeriod: 5000,
  });
  mqttClient = client;

  client.on("connect", () => {
    mqttConnected = true;
    mqttLastError = null;
    mqttLastConnectedAt = new Date().toISOString();
    console.log(`MQTT subscriber connected to ${MQTT_BROKER_URL}`);

    client.subscribe(OBJECT_TOPIC, { qos: 1 }, (error) => {
      if (error) {
        console.error("MQTT object feed subscription error:", error.message);
      } else {
        console.log(`Subscribed to MQTT object feed: ${OBJECT_TOPIC}`);
      }
    });

    client.subscribe("$SYS/#", (error) => {
      if (error) {
        console.log(`MQTT broker stats unavailable: ${error.message}`);
      } else {
        console.log("Subscribed to MQTT broker stats: $SYS/#");
      }
    });
  });

  client.on("error", (error) => {
    mqttLastError = error.message;
    console.log("MQTT error:", error.message);
  });
  client.on("offline", () => {
    mqttConnected = false;
    console.log("MQTT offline");
  });
  client.on("close", () => {
    mqttConnected = false;
  });
  client.on("reconnect", () => {
    mqttReconnectCount += 1;
    console.log("MQTT reconnecting...");
  });

  client.on("message", (topic, message) => {
    if (topic.startsWith("$SYS/")) {
      mqttSysStats[topic] = message.toString();
      return;
    }

    if (topic !== OBJECT_TOPIC) {
      return;
    }

    try {
      handleIncomingPayload("MQTT", JSON.parse(message.toString()));
    } catch (error) {
      console.error("MQTT JSON parse error:", error.message);
    }
  });
}

startMqttSubscriber();
