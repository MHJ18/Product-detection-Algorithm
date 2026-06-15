import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Broadcast,
  HddNetwork,
  PlayFill,
  Send,
  Terminal,
  Wifi,
} from "react-bootstrap-icons";
import Context from "../../Context/DashboardContext";
import "./MqttCli.css";

const quickCommands = [
  "status",
  "broker",
  "stats",
  "topics",
  "discover-topics",
  "connect",
  "publish-test",
  "help",
];

function MqttCli() {
  const { appSettings, connectionStatus, socket, transportMetrics } = useContext(Context);
  const [cliCommand, setCliCommand] = useState("status");
  const [cliLines, setCliLines] = useState([
    "MQTT broker console ready.",
    "Run status, broker, stats, topics, discover-topics, connect, publish-test, or help.",
  ]);

  const latestProtocol = transportMetrics.current?.protocol?.toUpperCase() || "Waiting";
  const connected = connectionStatus === "connected";
  const activeBroker = appSettings?.mqttBrokerUrl || "mqtt://test.mosquitto.org:1883";
  const activeTopic = appSettings?.mqttTopic || "softcity/hassaan/nicla-vision/statistics";

  const statusCards = useMemo(
    () => [
      {
        label: "Bridge",
        value: connectionStatus,
        helper: "React WebSocket state",
      },
      {
        label: "Active Broker",
        value: activeBroker.replace(/^mqtts?:\/\//, ""),
        helper: "Configured MQTT endpoint",
      },
      {
        label: "MQTT Latency",
        value:
          transportMetrics.byProtocol?.mqtt?.bridgeLatencyMs !== null &&
          transportMetrics.byProtocol?.mqtt?.bridgeLatencyMs !== undefined
            ? `${Number(transportMetrics.byProtocol.mqtt.bridgeLatencyMs).toFixed(1)} ms`
            : "Waiting",
        helper: "Bridge arrival timing",
      },
      {
        label: "Latest Transport",
        value: latestProtocol,
        helper: "Last packet source",
      },
    ],
    [activeBroker, connectionStatus, latestProtocol, transportMetrics],
  );

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleMessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== "mqtt_cli") {
          return;
        }

        const lines = message.data?.lines || [];
        setCliLines([
          `$ ${message.data?.command || "mqtt"}`,
          ...lines,
          `timestamp: ${message.data?.timestamp || new Date().toISOString()}`,
        ]);
      } catch (error) {
        setCliLines((current) => [...current, `CLI parse error: ${error.message}`]);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => socket.removeEventListener("message", handleMessage);
  }, [socket]);

  const sendCliCommand = (command = cliCommand) => {
    const normalized = String(command || "").trim();

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setCliLines([
        `$ ${normalized || "status"}`,
        "WebSocket bridge is not connected. Start the app backend first.",
      ]);
      return;
    }

    setCliCommand(normalized);
    setCliLines([`$ ${normalized}`, "Waiting for bridge response..."]);
    socket.send(
      JSON.stringify({
        type: "mqtt_cli_command",
        command: normalized,
      }),
    );
  };

  return (
    <main className="mqtt-cli-page">
      <section className="mqtt-cli-hero">
        <div>
          <p className="mqtt-cli-kicker">MQTT Console</p>
          <h1>Broker command center</h1>
          <span>Check the active broker connection, object topic, $SYS stats, topic discovery, and publish a test gear packet.</span>
        </div>
        <div className={`mqtt-cli-status ${connected ? "connected" : "disconnected"}`}>
          <Wifi />
          <span>{connected ? "Bridge Online" : connectionStatus}</span>
        </div>
      </section>

      <section className="mqtt-cli-status-grid">
        {statusCards.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="mqtt-cli-layout">
        <article className="mqtt-cli-terminal-card">
          <div className="mqtt-cli-panel-header">
            <div className="mqtt-cli-icon">
              <Terminal />
            </div>
              <div>
                <p>Interactive CLI</p>
              <h2>Run MQTT commands</h2>
              </div>
          </div>

          <div className="mqtt-cli-command-row">
            {quickCommands.map((command) => (
              <button key={command} type="button" onClick={() => sendCliCommand(command)}>
                <PlayFill />
                <span>{command}</span>
              </button>
            ))}
          </div>

          <div className="mqtt-cli-input">
            <input
              value={cliCommand}
              onChange={(event) => setCliCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  sendCliCommand();
                }
              }}
            />
            <button type="button" onClick={() => sendCliCommand()}>
              <Send />
              <span>Run</span>
            </button>
          </div>

          <pre className="mqtt-cli-terminal">{cliLines.join("\n")}</pre>
        </article>

        <aside className="mqtt-cli-side">
          <article>
            <div className="mqtt-cli-panel-header">
              <div className="mqtt-cli-icon">
                <Broadcast />
              </div>
              <div>
                <p>Topic</p>
                <h2>Object feed</h2>
              </div>
            </div>
            <code>{activeTopic}</code>
          </article>

          <article>
            <div className="mqtt-cli-panel-header">
              <div className="mqtt-cli-icon">
                <Broadcast />
              </div>
              <div>
                <p>Broker</p>
                <h2>Active MQTT endpoint</h2>
              </div>
            </div>
            <code>{activeBroker}</code>
          </article>

          <article>
            <div className="mqtt-cli-panel-header">
              <div className="mqtt-cli-icon">
                <HddNetwork />
              </div>
              <div>
                <p>Useful Commands</p>
                <h2>Broker validation flow</h2>
              </div>
            </div>
            <ul>
              <li><strong>status</strong> confirms broker connectivity.</li>
              <li><strong>broker</strong> confirms the active broker and topic.</li>
              <li><strong>stats</strong> reads $SYS values from the active broker when available.</li>
              <li><strong>discover-topics</strong> listens briefly on your app namespace.</li>
              <li><strong>discover-all</strong> samples public broker topics with #.</li>
              <li><strong>publish-test</strong> sends one test gear packet.</li>
            </ul>
          </article>
        </aside>
      </section>
    </main>
  );
}

export default MqttCli;
