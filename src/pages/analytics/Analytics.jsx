import React, { useContext, useMemo } from "react";
import { Download, Eye, Wifi, WifiOff } from "react-bootstrap-icons";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import Context from "../../Context/DashboardContext";
import "./Analytics.css";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const gearColors = {
  LargeGreenGear: "#16a34a",
  LargeYellowGear: "#f59e0b",
};

function getGearColor(className, index = 0) {
  return gearColors[className] || chartColors[index % chartColors.length];
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "Never";
  }

  const date = new Date(timestamp);
  return date.toLocaleString();
}

function exportRows(objectData) {
  const csvContent = [
    ["Object Name", "Frame Count", "Total Count", "Status", "Last Detected", "Timestamp"],
    ...objectData.map((item) => [
      item.objectName,
      item.frameCount,
      item.totalCount,
      item.status,
      item.lastSeen || "",
      item.timestamp || "",
    ]),
  ]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nicla-detection-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function Analytics() {
  const {
    connectionStatus,
    detectionHistory,
    detectionStats,
    lastUpdate,
    mode,
    objectData,
    transportMetrics,
  } = useContext(Context);

  const connected = connectionStatus === "connected";
  const activeRows = objectData.filter(
    (item) => item.totalCount > 0 || item.frameCount > 0,
  );
  const rows = activeRows.length > 0 ? activeRows : objectData;

  const commonOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            boxWidth: 10,
            color: mode === "dark-mode" ? "#cbd5e1" : "#475569",
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          bodyColor: "#e2e8f0",
          padding: 12,
          titleColor: "#ffffff",
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: mode === "dark-mode" ? "#cbd5e1" : "#64748b" },
        },
        y: {
          beginAtZero: true,
          grid: { color: mode === "dark-mode" ? "rgba(148, 163, 184, 0.18)" : "rgba(148, 163, 184, 0.22)" },
          ticks: { color: mode === "dark-mode" ? "#cbd5e1" : "#64748b", precision: 0 },
        },
      },
    }),
    [mode],
  );

  const totalChartData = useMemo(
    () => ({
      labels: rows.map((item) => item.objectName),
      datasets: [
        {
          label: "Total passes",
          data: rows.map((item) => item.totalCount),
          backgroundColor: rows.map((item, index) => getGearColor(item.objectName, index)),
          borderRadius: 8,
          maxBarThickness: 44,
        },
      ],
    }),
    [rows],
  );

  const gearTotalPieData = useMemo(
    () => ({
      labels: rows.map((item) => item.objectName),
      datasets: [
        {
          label: "Total detections",
          data: rows.map((item) => item.totalCount),
          backgroundColor: rows.map((item, index) => getGearColor(item.objectName, index)),
          borderColor: "#ffffff",
          borderWidth: 3,
        },
      ],
    }),
    [rows],
  );

  const historyChartData = useMemo(
    () => ({
      labels: detectionHistory.map((item) => item.label),
      datasets: [
        {
          label: "Frame detections",
          data: detectionHistory.map((item) => item.activeDetections),
          borderColor: "#2563eb",
          pointRadius: 2,
          tension: 0.35,
        },
        {
          label: "Total detections",
          data: detectionHistory.map((item) => item.totalDetections),
          borderColor: "#16a34a",
          pointRadius: 2,
          tension: 0.35,
        },
      ],
    }),
    [detectionHistory],
  );

  const gearDistributionData = useMemo(
    () => ({
      labels: detectionHistory.map((item) => item.label),
      datasets: rows.map((row, index) => ({
        label: row.objectName,
        data: detectionHistory.map((item) => Number(item.classTotals?.[row.objectName] || 0)),
        borderColor: getGearColor(row.objectName, index),
        backgroundColor: getGearColor(row.objectName, index),
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        stepped: "after",
        tension: 0,
      })),
    }),
    [detectionHistory, rows],
  );

  const latencyChartData = useMemo(
    () => ({
      labels: detectionHistory.map((item) => item.label),
      datasets: [
        {
          label: "MQTT latency",
          data: detectionHistory.map((item) => item.mqttLatencyMs),
          borderColor: "#0891b2",
          backgroundColor: "rgba(8, 145, 178, 0.14)",
          fill: true,
          pointRadius: 2,
          tension: 0.35,
        },
      ],
    }),
    [detectionHistory],
  );

  const classRankingData = useMemo(
    () => {
      const rankedRows = [...rows].sort(
        (a, b) => Number(b.totalCount || 0) - Number(a.totalCount || 0),
      );

      return {
        labels: rankedRows.map((item) => item.objectName),
        datasets: [
          {
            label: "Total passes",
            data: rankedRows.map((item) => item.totalCount),
            backgroundColor: rankedRows.map((item, index) => getGearColor(item.objectName, index)),
            borderRadius: 8,
            maxBarThickness: 28,
          },
        ],
      };
    },
    [rows],
  );

  const utilizationData = useMemo(
    () => {
      const active = rows.filter((item) => Number(item.frameCount || 0) > 0).length;
      const inactive = Math.max(rows.length - active, 0);

      return {
        labels: ["Active", "Inactive"],
        datasets: [
          {
            data: [active, inactive],
            backgroundColor: ["#16a34a", "#cbd5e1"],
            borderColor: "#ffffff",
            borderWidth: 3,
          },
        ],
      };
    },
    [rows],
  );

  const latestTransport = transportMetrics.current?.protocol?.toUpperCase() || "Waiting";

  return (
    <main className="analytics-page">
      <section className="analytics-topbar">
        <div>
          <p className="analytics-kicker">Home</p>
          <h1>Production intelligence overview</h1>
          <span>Real-time class performance, transport timing, and inspection history.</span>
        </div>
        <div className="analytics-actions">
          <div className={`analytics-connection ${connected ? "connected" : "disconnected"}`}>
            {connected ? <Wifi /> : <WifiOff />}
            <span>{connected ? "Connected" : connectionStatus}</span>
          </div>
          <button className="analytics-export" onClick={() => exportRows(objectData)}>
            <Download />
            Export CSV
          </button>
        </div>
      </section>

      <section className="analytics-panel analytics-panel-full analytics-history-feature">
        <div className="analytics-panel-heading">
          <h2>Detection history</h2>
          <p>Recent active-frame and cumulative movement</p>
        </div>
        <div className="analytics-chart analytics-chart-tall">
          {detectionHistory.length > 0 ? (
            <Line data={historyChartData} options={commonOptions} />
          ) : (
            <div className="analytics-empty">
              <Eye />
              <span>Waiting for the first Nicla detection packet.</span>
            </div>
          )}
        </div>
      </section>

      <section className="analytics-kpi-grid">
        <article>
          <span>Total detections</span>
          <strong>{detectionStats.totalDetections.toLocaleString()}</strong>
          <p>All classes combined</p>
        </article>
        <article>
          <span>Active this frame</span>
          <strong>{detectionStats.activeDetections}</strong>
          <p>{detectionStats.activeTypes} active class types</p>
        </article>
        <article>
          <span>Tracked classes</span>
          <strong>{detectionStats.trackedTypes}</strong>
          <p>Loaded from Nicla labels</p>
        </article>
        <article>
          <span>Last update</span>
          <strong>{lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "Waiting"}</strong>
          <p>WebSocket status: {connectionStatus}</p>
        </article>
        <article>
          <span>Latest transport</span>
          <strong>{latestTransport}</strong>
          <p>MQTT bridge telemetry</p>
        </article>
      </section>

      <section className="analytics-chart-grid">
        <article className="analytics-panel analytics-panel-wide">
          <div className="analytics-panel-heading">
            <h2>Total count by class</h2>
            <p>Passes counted after gate crossing logic</p>
          </div>
          <div className="analytics-chart">
            <Bar data={totalChartData} options={commonOptions} />
          </div>
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-heading">
            <h2>Gear detection share</h2>
            <p>Total detections counted for each gear</p>
          </div>
          <div className="analytics-chart">
            <Doughnut
              data={gearTotalPieData}
              options={{
                ...commonOptions,
                cutout: "62%",
                scales: undefined,
                plugins: {
                  ...commonOptions.plugins,
                  legend: { position: "bottom", labels: commonOptions.plugins.legend.labels },
                },
              }}
            />
          </div>
        </article>

        <article className="analytics-panel analytics-panel-full analytics-transport-utilization-panel">
          <div className="analytics-panel-heading">
            <h2>Transport latency and class utilization</h2>
            <p>Bridge timing beside active versus inactive class coverage</p>
          </div>
          <div className="analytics-combo-grid">
            <section>
              <div className="analytics-subheading">
                <p>Transport latency history</p>
                <h3>MQTT arrival timing</h3>
              </div>
              <div className="analytics-chart">
                {detectionHistory.some((item) => item.mqttLatencyMs !== null) ? (
                  <Line data={latencyChartData} options={commonOptions} />
                ) : (
                  <div className="analytics-empty">
                    <Eye />
                    <span>Waiting for timed MQTT packets.</span>
                  </div>
                )}
              </div>
            </section>
            <section>
              <div className="analytics-subheading">
                <p>Class utilization</p>
                <h3>Active versus inactive classes</h3>
              </div>
              <div className="analytics-chart">
                <Doughnut
                  data={utilizationData}
                  options={{
                    ...commonOptions,
                    cutout: "68%",
                    scales: undefined,
                    plugins: {
                      ...commonOptions.plugins,
                      legend: { position: "bottom", labels: commonOptions.plugins.legend.labels },
                    },
                  }}
                />
              </div>
            </section>
          </div>
        </article>

        <article className="analytics-panel analytics-panel-full">
          <div className="analytics-panel-heading">
            <h2>Gear distribution over time</h2>
            <p>Cumulative class totals from each conveyor packet</p>
          </div>
          <div className="analytics-chart analytics-chart-tall">
            {detectionHistory.length > 0 ? (
              <Line
                data={gearDistributionData}
                options={{
                  ...commonOptions,
                  plugins: {
                    ...commonOptions.plugins,
                    legend: {
                      position: "top",
                      labels: commonOptions.plugins.legend.labels,
                    },
                  },
                }}
              />
            ) : (
              <div className="analytics-empty">
                <Eye />
                <span>Waiting for class totals to build the gear distribution timeline.</span>
              </div>
            )}
          </div>
        </article>

        <article className="analytics-panel analytics-panel-full">
          <div className="analytics-panel-heading">
            <h2>Class ranking</h2>
            <p>Sorted conveyor object totals for quick inspection readout</p>
          </div>
          <div className="analytics-chart analytics-chart-tall">
            <Bar
              data={classRankingData}
              options={{
                ...commonOptions,
                indexAxis: "y",
                plugins: {
                  ...commonOptions.plugins,
                  legend: { display: false },
                },
              }}
            />
          </div>
        </article>
      </section>

      <section className="analytics-panel analytics-table-panel">
        <div className="analytics-panel-heading">
          <h2>Class detail table</h2>
          <p>Latest frame count, cumulative total, and last seen timestamp</p>
        </div>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Object class</th>
                <th>Frame</th>
                <th>Total</th>
                <th>Status</th>
                <th>Last seen</th>
                <th>Payload time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.objectName}>
                  <td>
                    <strong>{item.objectName}</strong>
                  </td>
                  <td>{item.frameCount}</td>
                  <td>{item.totalCount}</td>
                  <td>
                    <span className={`analytics-status ${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{formatTimestamp(item.lastSeen)}</td>
                  <td>{formatTimestamp(item.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default Analytics;
