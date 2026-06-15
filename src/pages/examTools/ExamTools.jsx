import React, { useContext } from "react";
import {
  Activity,
  Broadcast,
  ClockHistory,
  Cpu,
  Database,
  Diagram3,
  Display,
  ExclamationTriangle,
  LightningCharge,
  Terminal,
} from "react-bootstrap-icons";
import Context from "../../Context/DashboardContext";
import "./ExamTools.css";

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString() : "Waiting";
}

function formatBytes(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Waiting";
  }

  const bytes = Number(value);
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatMemoryDetail(usedOrFree, total, mode = "free") {
  if (usedOrFree === null || usedOrFree === undefined || Number.isNaN(Number(usedOrFree))) {
    return "Waiting for camera packet";
  }

  if (total === null || total === undefined || Number.isNaN(Number(total))) {
    return `${mode === "used" ? "Used" : "Free"} ${formatBytes(usedOrFree)}`;
  }

  const percent = Math.round((Number(usedOrFree) / Number(total)) * 100);
  return `${mode === "used" ? "Used" : "Free"} ${formatBytes(usedOrFree)} of ${formatBytes(total)} (${percent}%)`;
}

function PageHero({ kicker, title, children }) {
  return (
    <section className="exam-hero">
      <div>
        <p className="exam-kicker">{kicker}</p>
        <h1>{title}</h1>
        <span className="exam-muted">{children}</span>
      </div>
    </section>
  );
}

function FlowNode({ icon, title, subtitle, metric, status }) {
  return (
    <article className="architecture-node">
      <div className="architecture-node-icon">{icon}</div>
      <div>
        <p>{title}</p>
        <h2>{subtitle}</h2>
        <span>{metric}</span>
      </div>
      <b className={`architecture-status ${status}`}>{status}</b>
    </article>
  );
}

export function ArchitecturePage() {
  const {
    appRunMode,
    appSettings,
    cameraMemory,
    connectionStatus,
    detectionStats,
    feedStatus,
    lastUpdate,
    transportMetrics,
  } = useContext(Context);

  const latestTransport = transportMetrics.current?.protocol?.toUpperCase() || "Waiting";
  const sourceTitle = appRunMode === "demo" ? "React Generator" : "Nicla Vision";
  const sourceStatus = feedStatus === "live" || appRunMode === "demo" ? "online" : "waiting";
  const activeBroker = appSettings?.mqttBrokerUrl || "mqtt://test.mosquitto.org:1883";
  const activeTopic = appSettings?.mqttTopic || "softcity/hassaan/nicla-vision/statistics";

  return (
    <main className="exam-page">
      <PageHero kicker="System Architecture" title="IoT conveyor architecture">
        Vertical flow from image source to MQTT broker, bridge processing, WebSocket delivery, and Home visualization.
      </PageHero>

      <section className="architecture-layout">
        <div className="architecture-figure">
          <FlowNode
            icon={<LightningCharge />}
            title="01 Source Layer"
            subtitle={sourceTitle}
            metric={`${detectionStats.activeDetections} active frame detections`}
            status={sourceStatus}
          />
          <div className="architecture-connector">
            <span>MQTT payload</span>
          </div>
          <FlowNode
            icon={<Broadcast />}
            title="02 Broker Layer"
            subtitle={activeBroker.replace(/^mqtts?:\/\//, "")}
            metric={activeTopic}
            status={latestTransport === "MQTT" ? "online" : "waiting"}
          />
          <div className="architecture-connector">
            <span>Subscribe + normalize</span>
          </div>
          <FlowNode
            icon={<Cpu />}
            title="03 Bridge Layer"
            subtitle="Node.js Processor"
            metric={`WebSocket: ${connectionStatus}`}
            status={connectionStatus === "connected" ? "online" : "warning"}
          />
          <div className="architecture-connector">
            <span>Realtime WebSocket stream</span>
          </div>
          <FlowNode
            icon={<Display />}
            title="04 Experience Layer"
            subtitle="React Home"
            metric={`Last update: ${formatTime(lastUpdate)}`}
            status="online"
          />
        </div>

        <aside className="architecture-summary">
          <div>
            <Diagram3 />
            <p>Current Transport</p>
            <strong>{latestTransport}</strong>
          </div>
          <div>
            <Database />
            <p>Tracked Classes</p>
            <strong>{detectionStats.trackedTypes}</strong>
          </div>
          <div>
            <Broadcast />
            <p>MQTT Latency</p>
            <strong>
              {transportMetrics.byProtocol?.mqtt?.bridgeLatencyMs ?? "Waiting"}
              {transportMetrics.byProtocol?.mqtt ? " ms" : ""}
            </strong>
          </div>
          <div className="architecture-memory-card">
            <Cpu />
            <p>Camera Memory</p>
            <div className="architecture-memory-grid">
              <section>
                <span>RAM</span>
                <strong>{formatBytes(cameraMemory?.ramFreeBytes)}</strong>
                <small>{formatMemoryDetail(cameraMemory?.ramFreeBytes, cameraMemory?.ramTotalBytes, "free")}</small>
              </section>
              <section>
                <span>ROM</span>
                <strong>{formatBytes(cameraMemory?.romUsedBytes ?? cameraMemory?.romFreeBytes)}</strong>
                <small>
                  {cameraMemory?.romUsedBytes !== undefined && cameraMemory?.romUsedBytes !== null
                    ? formatMemoryDetail(cameraMemory.romUsedBytes, cameraMemory?.romTotalBytes, "used")
                    : formatMemoryDetail(cameraMemory?.romFreeBytes, cameraMemory?.romTotalBytes, "free")}
                </small>
              </section>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export function EventLogPage() {
  const { alerts, eventLog, lastUpdate } = useContext(Context);
  const packetCount = eventLog.filter((event) => event.type === "packet").length;
  const cliCount = eventLog.filter((event) => event.type === "cli").length;
  const issueCount = eventLog.filter((event) => event.type === "error").length + alerts.length;
  const latestEvent = eventLog[0];

  const statCards = [
    {
      icon: <Activity />,
      label: "Total Events",
      value: eventLog.length,
      helper: "Last 80 retained",
      tone: "cyan",
    },
    {
      icon: <Broadcast />,
      label: "Packet Events",
      value: packetCount,
      helper: `Last packet ${formatTime(lastUpdate)}`,
      tone: "green",
    },
    {
      icon: <Terminal />,
      label: "CLI Responses",
      value: cliCount,
      helper: "MQTT console activity",
      tone: "blue",
    },
    {
      icon: <ExclamationTriangle />,
      label: "Active Issues",
      value: issueCount,
      helper: issueCount > 0 ? "Review warnings" : "System normal",
      tone: issueCount > 0 ? "amber" : "green",
    },
  ];

  return (
    <main className="exam-page">
      <PageHero kicker="Audit Trail" title="System event log">
        Packets, mode switches, CLI responses, connection changes, and errors are recorded here.
      </PageHero>

      <section className="event-stats-grid">
        {statCards.map((card) => (
          <article className={`event-stat-card ${card.tone}`} key={card.label}>
            <div className="event-stat-icon">{card.icon}</div>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.helper}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="event-log-layout">
        <article className="event-log-panel">
          <div className="event-panel-heading">
            <div>
              <p>Realtime Timeline</p>
              <h2>Latest system activity</h2>
            </div>
            <span>{eventLog.length} records</span>
          </div>

          <div className="event-table-wrap">
            <table className="event-table">
              <thead>
                <tr><th>Time</th><th>Type</th><th>Event</th><th>Details</th></tr>
              </thead>
              <tbody>
                {eventLog.length === 0 ? (
                  <tr>
                    <td colSpan="4">
                      <div className="event-empty">Waiting for system events...</div>
                    </td>
                  </tr>
                ) : eventLog.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <span className="event-time">{formatTime(event.timestamp)}</span>
                    </td>
                    <td>
                      <span className={`event-type event-type-${event.type}`}>{event.type}</span>
                    </td>
                    <td>
                      <strong className="event-message">{event.message}</strong>
                    </td>
                    <td>
                      <code className="event-details">
                        {Object.keys(event.details || {}).length ? JSON.stringify(event.details) : "-"}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="event-side-panel">
          <article>
            <ClockHistory />
            <p>Latest Event</p>
            <strong>{latestEvent ? latestEvent.message : "Waiting"}</strong>
            <span>{latestEvent ? formatTime(latestEvent.timestamp) : "No events yet"}</span>
          </article>
          <article>
            <ExclamationTriangle />
            <p>Alert Rules</p>
            {alerts.length === 0 ? (
              <strong>No active alerts</strong>
            ) : alerts.map((alert) => (
              <div className="event-alert" key={alert.title}>
                <b>{alert.title}</b>
                <span>{alert.message}</span>
              </div>
            ))}
          </article>
        </aside>
      </section>
    </main>
  );
}
