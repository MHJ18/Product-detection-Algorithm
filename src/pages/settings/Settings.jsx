import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  ArrowCounterclockwise,
  CheckCircleFill,
  Cpu,
  ExclamationTriangleFill,
  HddNetwork,
  Save,
  Sliders,
  Wifi,
} from "react-bootstrap-icons";
import Context from "../../Context/DashboardContext";
import {
  DEFAULT_APP_SETTINGS,
  MQTT_BROKER_PRESETS,
  resetStoredSettings,
  saveStoredSettings,
} from "../../config/appSettings";
import "./Settings.css";

const fields = [
  {
    group: "Connection",
    icon: <HddNetwork />,
    items: [
      { key: "backendHost", label: "Backend IP / Host", type: "text" },
      { key: "websocketPort", label: "WebSocket Port", type: "number" },
      { key: "mqttBrokerUrl", label: "MQTT Broker URL", type: "text" },
      { key: "mqttTopic", label: "MQTT Topic", type: "text" },
    ],
  },
  {
    group: "Wi-Fi",
    icon: <Wifi />,
    items: [
      { key: "wifiSsid", label: "Wi-Fi SSID", type: "text" },
      { key: "wifiPassword", label: "Wi-Fi Password", type: "password" },
    ],
  },
  {
    group: "Publisher",
    icon: <Sliders />,
    items: [
      { key: "packetIntervalMs", label: "Packet interval ms", type: "number" },
      { key: "heartbeatMs", label: "Heartbeat ms", type: "number" },
    ],
  },
];

function SettingField({ field, value, onChange }) {
  if (field.type === "checkbox") {
    return (
      <label className="settings-field settings-field-checkbox">
        <span>{field.label}</span>
        <input
          checked={String(value) === "true"}
          type="checkbox"
          onChange={(event) => onChange(field.key, event.target.checked ? "true" : "false")}
        />
      </label>
    );
  }

  return (
    <label className="settings-field">
      <span>{field.label}</span>
      <input
        autoComplete={field.key === "wifiPassword" ? "current-password" : "off"}
        type={field.type}
        step={field.step}
        value={value}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    </label>
  );
}

function normalizeSettings(settings) {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...settings,
    backendHost: String(settings.backendHost || DEFAULT_APP_SETTINGS.backendHost).trim(),
    websocketPort: String(settings.websocketPort || DEFAULT_APP_SETTINGS.websocketPort).trim(),
    mqttBrokerMode: MQTT_BROKER_PRESETS[settings.mqttBrokerMode]
      ? settings.mqttBrokerMode
      : DEFAULT_APP_SETTINGS.mqttBrokerMode,
    mqttBrokerUrl: String(settings.mqttBrokerUrl || DEFAULT_APP_SETTINGS.mqttBrokerUrl).trim(),
    mqttTopic: String(settings.mqttTopic || DEFAULT_APP_SETTINGS.mqttTopic).trim(),
    packetIntervalMs: String(settings.packetIntervalMs || DEFAULT_APP_SETTINGS.packetIntervalMs).trim(),
    heartbeatMs: String(settings.heartbeatMs || DEFAULT_APP_SETTINGS.heartbeatMs).trim(),
  };
}

function validateSettings(settings) {
  const errors = [];
  const portFields = [
    ["websocketPort", "WebSocket Port"],
  ];

  if (!settings.backendHost) {
    errors.push("Backend host is required.");
  }

  portFields.forEach(([key, label]) => {
    const value = Number(settings[key]);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      errors.push(`${label} must be a valid port from 1 to 65535.`);
    }
  });

  if (!settings.mqttBrokerUrl.startsWith("mqtt://") && !settings.mqttBrokerUrl.startsWith("mqtts://")) {
    errors.push("MQTT Broker URL must start with mqtt:// or mqtts://.");
  }

  if (!settings.mqttTopic || settings.mqttTopic.includes(" ")) {
    errors.push("MQTT Topic is required and cannot contain spaces.");
  }

  return errors;
}

function Settings() {
  const {
    appSettings,
    appRunMode,
    connectionStatus,
    setAppSettings,
    socket,
    websocketUrl,
  } = useContext(Context);
  const [draft, setDraft] = useState(appSettings || DEFAULT_APP_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState([]);
  const [testState, setTestState] = useState({
    message: "Run a bridge test before switching to the camera feed.",
    status: "idle",
  });

  useEffect(() => {
    setDraft(appSettings || DEFAULT_APP_SETTINGS);
  }, [appSettings]);

  const normalizedDraft = useMemo(() => normalizeSettings(draft), [draft]);
  const previewWebsocketUrl = useMemo(
    () => `ws://${normalizedDraft.backendHost}:${normalizedDraft.websocketPort}`,
    [normalizedDraft.backendHost, normalizedDraft.websocketPort],
  );

  const handleChange = (key, value) => {
    setSaved(false);
    setErrors([]);
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === "mqttBrokerUrl" ? { mqttBrokerMode: "custom" } : {}),
    }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    const nextSettings = normalizeSettings(draft);
    const nextErrors = validateSettings(nextSettings);

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      setSaved(false);
      return;
    }

    saveStoredSettings(nextSettings);
    setAppSettings(nextSettings);
    setSaved(true);
    setTestState({
      message: "Settings saved locally. Bridge runtime update sent when the WebSocket is open.",
      status: "success",
    });

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "settings_update",
          settings: nextSettings,
        }),
      );
    }
  };

  const handleReset = () => {
    resetStoredSettings();
    setDraft(DEFAULT_APP_SETTINGS);
    setAppSettings(DEFAULT_APP_SETTINGS);
    setSaved(false);
    setErrors([]);
    setTestState({
      message: "Settings reset to the public MQTT bridge defaults.",
      status: "idle",
    });

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "settings_update",
          settings: DEFAULT_APP_SETTINGS,
        }),
      );
    }
  };

  const handleTestBridge = () => {
    const nextSettings = normalizeSettings(draft);
    const nextErrors = validateSettings(nextSettings);

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      setTestState({ message: "Fix the validation errors before testing.", status: "error" });
      return;
    }

    setErrors([]);
    setTestState({ message: `Connecting to ${previewWebsocketUrl}...`, status: "testing" });

    let settled = false;
    const testSocket = new WebSocket(previewWebsocketUrl);
    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      testSocket.close();
      setTestState({
        message: "Bridge test timed out. Start npm server or check the WebSocket port.",
        status: "error",
      });
    }, 3500);

    testSocket.onopen = () => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
    setTestState({
      message: "Bridge reachable. Real mode can receive MQTT camera packets through this endpoint.",
      status: "success",
    });
      testSocket.close();
    };

    testSocket.onerror = () => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      setTestState({
        message: "Bridge test failed. Confirm the Node bridge is running and the host/port are correct.",
        status: "error",
      });
    };
  };

  return (
    <main className="settings-page">
      <section className="settings-hero">
        <div>
          <p className="settings-kicker">Device Settings</p>
          <h1>MQTT feed configuration</h1>
          <span>Real mode uses this bridge to receive camera packets from MQTT.</span>
        </div>
        <div className={`settings-status settings-status-${connectionStatus}`}>
          <Cpu />
          <span>{connectionStatus} - {appRunMode}</span>
        </div>
      </section>

      <form className="settings-layout" onSubmit={handleSave}>
        <section className="settings-form-grid">
          <article className="settings-panel settings-mqtt-mode-panel">
            <div className="settings-panel-header">
              <div className="settings-panel-icon">
                <HddNetwork />
              </div>
              <h2>MQTT Broker Mode</h2>
            </div>
            <div className="settings-preset-grid">
              {Object.entries(MQTT_BROKER_PRESETS).map(([mode, preset]) => (
                <button
                  className={`settings-preset-button ${
                    normalizedDraft.mqttBrokerMode === mode ? "settings-preset-active" : ""
                  }`}
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSaved(false);
                    setErrors([]);
                    setDraft((current) => ({
                      ...current,
                      mqttBrokerMode: mode,
                      mqttBrokerUrl:
                        mode === "custom"
                          ? current.mqttBrokerUrl || DEFAULT_APP_SETTINGS.mqttBrokerUrl
                          : preset.url,
                    }));
                  }}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.note}</span>
                </button>
              ))}
            </div>
          </article>

          {fields.map((group) => (
            <article className="settings-panel" key={group.group}>
              <div className="settings-panel-header">
                <div className="settings-panel-icon">{group.icon}</div>
                <h2>{group.group}</h2>
              </div>
              <div className="settings-fields">
                {group.items.map((field) => (
                  <SettingField
                    field={field}
                    key={field.key}
                    value={draft[field.key] || ""}
                    onChange={handleChange}
                  />
                ))}
              </div>
            </article>
          ))}
        </section>

        <aside className="settings-side-panel">
          <article className="settings-panel">
            <div className="settings-panel-header">
              <div className="settings-panel-icon">
                <HddNetwork />
              </div>
              <h2>Live Feed</h2>
            </div>
            <div className="settings-readout">
              <span>WebSocket URL</span>
              <strong>{previewWebsocketUrl}</strong>
            </div>
            <div className="settings-readout">
              <span>MQTT Mode</span>
              <strong>{MQTT_BROKER_PRESETS[normalizedDraft.mqttBrokerMode]?.label}</strong>
            </div>
            <div className="settings-readout">
              <span>MQTT Broker</span>
              <strong>{normalizedDraft.mqttBrokerUrl}</strong>
            </div>
            <div className="settings-readout">
              <span>Object Topic</span>
              <strong>{normalizedDraft.mqttTopic}</strong>
            </div>
            <div className="settings-readout">
              <span>Current App Socket</span>
              <strong>{websocketUrl}</strong>
            </div>
          </article>

          <article className={`settings-test-card settings-test-${testState.status}`}>
            <div className="settings-test-icon">
              {testState.status === "error" ? <ExclamationTriangleFill /> : <CheckCircleFill />}
            </div>
            <div>
              <h2>Bridge readiness</h2>
              <p>{testState.message}</p>
            </div>
          </article>

          {errors.length > 0 && (
            <article className="settings-error-card" role="alert">
              <strong>Check these settings</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </article>
          )}

          <div className="settings-actions">
            <button className="settings-secondary-button" type="button" onClick={handleTestBridge}>
              <Cpu />
              <span>Test</span>
            </button>
            <button className="settings-secondary-button" type="button" onClick={handleReset}>
              <ArrowCounterclockwise />
              <span>Reset</span>
            </button>
            <button className="settings-primary-button" type="submit">
              <Save />
              <span>{saved ? "Saved" : "Save"}</span>
            </button>
          </div>
        </aside>
      </form>
    </main>
  );
}

export default Settings;
