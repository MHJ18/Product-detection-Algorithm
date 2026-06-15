export const DEFAULT_APP_SETTINGS = {
  backendHost: "localhost",
  websocketPort: "8080",
  mqttBrokerMode: "public",
  mqttBrokerUrl: "mqtt://test.mosquitto.org:1883",
  mqttTopic: "softcity/hassaan/nicla-vision/statistics",
  packetIntervalMs: "2200",
  heartbeatMs: "5000",
  sequentialPublisherEnabled: "false",
  sequentialPublishIntervalMs: "3000",
  wifiSsid: "Hassaan S23",
  wifiPassword: "0987654321",
};

export const MQTT_BROKER_PRESETS = {
  local: {
    label: "Local Mosquitto",
    url: "mqtt://127.0.0.1:1883",
    note: "Use only after Mosquitto is configured for network access.",
  },
  public: {
    label: "Public Test Broker",
    url: "mqtt://test.mosquitto.org:1883",
    note: "Recommended for this demo because it avoids local firewall/config issues.",
  },
  custom: {
    label: "Custom Broker",
    url: "",
    note: "Use your own MQTT host, port, and security scheme.",
  },
};

const STORAGE_KEY = "softcityVisionSettings";
const LEGACY_OBJECT_TOPIC = "object-detection/statistics";

function inferBrokerMode(brokerUrl) {
  if (brokerUrl === MQTT_BROKER_PRESETS.local.url) {
    return "local";
  }

  if (brokerUrl === MQTT_BROKER_PRESETS.public.url) {
    return "public";
  }

  return "custom";
}

export function getStoredSettings() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return DEFAULT_APP_SETTINGS;
    }

    const parsedSettings = JSON.parse(stored);
    const storedBrokerUrl = parsedSettings.mqttBrokerUrl;
    const storedTopic = parsedSettings.mqttTopic;
    const nextBrokerUrl = !storedBrokerUrl ? DEFAULT_APP_SETTINGS.mqttBrokerUrl : storedBrokerUrl;
    const migratedSettings = {
      ...parsedSettings,
      mqttBrokerUrl: nextBrokerUrl,
      mqttBrokerMode:
        parsedSettings.mqttBrokerMode ||
        inferBrokerMode(nextBrokerUrl),
      mqttTopic:
        !storedTopic || storedTopic === LEGACY_OBJECT_TOPIC
          ? DEFAULT_APP_SETTINGS.mqttTopic
          : storedTopic,
    };

    return {
      ...DEFAULT_APP_SETTINGS,
      ...migratedSettings,
      packetIntervalMs:
        migratedSettings.packetIntervalMs ||
        migratedSettings.demoIntervalMs ||
        DEFAULT_APP_SETTINGS.packetIntervalMs,
    };
  } catch (error) {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveStoredSettings(settings) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...DEFAULT_APP_SETTINGS,
      ...settings,
    }),
  );
  window.dispatchEvent(new Event("softcity-settings-updated"));
}

export function resetStoredSettings() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("softcity-settings-updated"));
}
