import React, { useContext, useMemo } from "react";
import { Bar, Chart, Doughnut, Line, Pie, Radar, Scatter } from "react-chartjs-2";
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
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { Activity, Broadcast, PieChart, Speedometer2 } from "react-bootstrap-icons";
import Context from "../../Context/DashboardContext";
import "./Charts.css";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
);

const palette = ["#0891b2", "#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];
const gearColors = {
  LargeGreenGear: "#16a34a",
  LargeYellowGear: "#f59e0b",
};

function getGearColor(className, index = 0) {
  return gearColors[className] || palette[index % palette.length];
}

function formatMs(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Waiting";
  }

  return `${Number(value).toFixed(1)} ms`;
}

function ChartPanel({ className = "", icon, kicker, title, children, wide = false }) {
  return (
    <article className={`charts-panel${wide ? " charts-panel-wide" : ""}${className ? ` ${className}` : ""}`}>
      <div className="charts-panel-header">
        <div>
          <p>{kicker}</p>
          <h2>{title}</h2>
        </div>
        {icon}
      </div>
      {children}
    </article>
  );
}

function GaugeCard({ value, activeTypes, trackedTypes }) {
  return (
    <article className="charts-panel charts-gauge-panel">
      <div className="charts-panel-header">
        <div>
          <p>Gauge</p>
          <h2>Line activity load</h2>
        </div>
        <Speedometer2 />
      </div>
      <div className="charts-gauge" style={{ "--gauge-value": `${value}%` }}>
        <div className="charts-gauge-ring">
          <div>
            <strong>{value}%</strong>
            <span>{activeTypes} of {trackedTypes} classes active</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Charts() {
  const {
    detectionHistory,
    detectionStats,
    mode,
    objectData,
    transportMetrics,
  } = useContext(Context);

  const rows = useMemo(
    () => objectData.filter((item) => item.objectName),
    [objectData],
  );

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

  const labels = rows.map((item) => item.objectName);
  const frameCounts = rows.map((item) => Number(item.frameCount || 0));
  const totalCounts = rows.map((item) => Number(item.totalCount || 0));

  const lineData = useMemo(
    () => ({
      labels: detectionHistory.map((item) => item.label),
      datasets: [
        {
          label: "Active frame",
          data: detectionHistory.map((item) => item.activeDetections),
          borderColor: "#16a34a",
          backgroundColor: "rgba(22, 163, 74, 0.1)",
          fill: true,
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
      datasets: labels.map((label, index) => ({
        label,
        data: detectionHistory.map((item) => Number(item.classTotals?.[label] || 0)),
        borderColor: getGearColor(label, index),
        backgroundColor: getGearColor(label, index),
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        stepped: "after",
        tension: 0,
      })),
    }),
    [detectionHistory, labels],
  );

  const barData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Current frame",
          data: frameCounts,
          backgroundColor: labels.map((label, index) => getGearColor(label, index)),
          borderRadius: 8,
          maxBarThickness: 38,
        },
      ],
    }),
    [frameCounts, labels],
  );

  const pieData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: totalCounts,
          backgroundColor: labels.map((label, index) => getGearColor(label, index)),
          borderColor: "#ffffff",
          borderWidth: 3,
        },
      ],
    }),
    [labels, totalCounts],
  );

  const scatterData = useMemo(
    () => ({
      datasets: [
        {
          label: "Class load",
          data: rows.map((item, index) => ({
            x: index + 1,
            y: Number(item.frameCount || 0),
          })),
          backgroundColor: rows.map((item, index) => getGearColor(item.objectName, index)),
          borderColor: rows.map((item, index) => getGearColor(item.objectName, index)),
          pointRadius: rows.map((item) => Math.max(5, Number(item.frameCount || 0) * 4 + 5)),
        },
      ],
    }),
    [rows],
  );

  const gaugeValue = detectionStats.trackedTypes
    ? Math.round((detectionStats.activeTypes / detectionStats.trackedTypes) * 100)
    : 0;
  const latestTransport = transportMetrics.current?.protocol?.toUpperCase() || "Waiting";
  const latestLatency =
    transportMetrics.current?.bridgeLatencyMs ??
    transportMetrics.current?.publishDurationMs;

  return (
    <main className="charts-page">
      <section className="charts-hero">
        <div>
          <p className="charts-kicker">Material Charts</p>
          <h1>Live IoT chart gallery</h1>
          <span>Line, area, marked line, bar, combo, radar, pie, scatter, donut, gauge, and latency views using current conveyor frame values.</span>
        </div>
        <div className="charts-protocol">
          <Broadcast />
          <div>
            <span>{latestTransport}</span>
            <strong>{formatMs(latestLatency)}</strong>
          </div>
        </div>
      </section>

      <section className="charts-grid">
        <ChartPanel className="charts-distribution-panel" icon={<Activity />} kicker="Timeline" title="Gear distribution over time" wide>
          <div className="charts-canvas charts-canvas-large">
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
          </div>
        </ChartPanel>

        <ChartPanel className="charts-trend-panel" icon={<Activity />} kicker="Line" title="Detection trend" wide>
          <div className="charts-canvas">
            <Line data={lineData} options={commonOptions} />
          </div>
        </ChartPanel>

        <article className="charts-panel charts-combo-panel charts-panel-wide">
          <div className="charts-panel-header">
            <div>
              <p>Combined View</p>
              <h2>Frame share and activity flow</h2>
            </div>
            <PieChart />
          </div>
          <div className="charts-combo-grid">
            <section>
              <div className="charts-subheading">
                <p>Area</p>
                <h3>Active-frame area flow</h3>
              </div>
              <div className="charts-canvas">
                <Line
                  data={{
                    labels: detectionHistory.map((item) => item.label),
                    datasets: [
                      {
                        label: "Active detections",
                        data: detectionHistory.map((item) => item.activeDetections),
                        borderColor: "#2563eb",
                        backgroundColor: "rgba(37, 99, 235, 0.18)",
                        fill: true,
                        pointRadius: 0,
                        tension: 0.42,
                      },
                    ],
                  }}
                  options={commonOptions}
                />
              </div>
            </section>
            <section>
              <div className="charts-subheading">
                <p>Pie</p>
                <h3>Total gear detection share</h3>
              </div>
              <div className="charts-canvas">
                <Pie
                  data={pieData}
                  options={{
                    ...commonOptions,
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

        <ChartPanel className="charts-marks-panel" icon={<Activity />} kicker="Marks" title="Marked active-frame line">
          <div className="charts-canvas">
            <Line
              data={{
                labels: detectionHistory.map((item) => item.label),
                datasets: [
                  {
                    label: "Active frame marks",
                    data: detectionHistory.map((item) => item.activeDetections),
                    borderColor: "#16a34a",
                    backgroundColor: "#16a34a",
                    pointBackgroundColor: "#ffffff",
                    pointBorderColor: "#16a34a",
                    pointBorderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.2,
                  },
                ],
              }}
              options={commonOptions}
            />
          </div>
        </ChartPanel>

        <ChartPanel className="charts-current-panel" icon={<Activity />} kicker="Bar" title="Current frame by class">
          <div className="charts-canvas">
            <Bar data={barData} options={{ ...commonOptions, plugins: { ...commonOptions.plugins, legend: { display: false } } }} />
          </div>
        </ChartPanel>

        <ChartPanel className="charts-overlay-panel" icon={<Activity />} kicker="Line + Bar" title="Throughput overlay" wide>
          <div className="charts-canvas">
            <Chart
              type="bar"
              data={{
                labels,
                datasets: [
                  {
                    type: "bar",
                    label: "Current frame",
                    data: frameCounts,
                    backgroundColor: labels.map((label, index) => getGearColor(label, index)),
                    borderRadius: 8,
                    maxBarThickness: 38,
                    yAxisID: "y",
                  },
                  {
                    type: "line",
                    label: "Active frame",
                    data: frameCounts,
                    borderColor: "#f59e0b",
                    backgroundColor: "#f59e0b",
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.36,
                    yAxisID: "y1",
                  },
                ],
              }}
              options={{
                ...commonOptions,
                scales: {
                  x: commonOptions.scales.x,
                  y: commonOptions.scales.y,
                  y1: {
                    beginAtZero: true,
                    grid: { drawOnChartArea: false },
                    position: "right",
                    ticks: {
                      color: mode === "dark-mode" ? "#cbd5e1" : "#64748b",
                      precision: 0,
                    },
                  },
                },
              }}
            />
          </div>
        </ChartPanel>

        <ChartPanel className="charts-stacked-panel" icon={<Activity />} kicker="Stacked" title="Frame load by class">
          <div className="charts-canvas">
            <Bar
              data={{
                labels,
                datasets: [
                  {
                    label: "Current frame",
                    data: frameCounts,
                    backgroundColor: labels.map((label, index) => getGearColor(label, index)),
                    borderRadius: 8,
                    stack: "class",
                  },
                  {
                    label: "Active marker",
                    data: frameCounts.map((value) => (value > 0 ? 1 : 0)),
                    backgroundColor: "#16a34a",
                    borderRadius: 8,
                    stack: "class",
                  },
                ],
              }}
              options={{
                ...commonOptions,
                scales: {
                  x: { ...commonOptions.scales.x, stacked: true },
                  y: { ...commonOptions.scales.y, stacked: true },
                },
              }}
            />
          </div>
        </ChartPanel>

        <ChartPanel className="charts-radar-panel" icon={<Activity />} kicker="Radar" title="Class performance signature">
          <div className="charts-canvas">
            <Radar
              data={{
                labels,
                datasets: [
                  {
                    label: "Active frame",
                    data: frameCounts,
                    backgroundColor: "rgba(22, 163, 74, 0.14)",
                    borderColor: "#16a34a",
                    borderWidth: 2,
                    pointBackgroundColor: "#16a34a",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: commonOptions.plugins,
                scales: {
                  r: {
                    angleLines: {
                      color: mode === "dark-mode" ? "rgba(148, 163, 184, 0.24)" : "rgba(148, 163, 184, 0.3)",
                    },
                    grid: {
                      color: mode === "dark-mode" ? "rgba(148, 163, 184, 0.2)" : "rgba(148, 163, 184, 0.28)",
                    },
                    pointLabels: {
                      color: mode === "dark-mode" ? "#cbd5e1" : "#475569",
                      font: { size: 11, weight: "bold" },
                    },
                    ticks: {
                      backdropColor: "transparent",
                      color: mode === "dark-mode" ? "#94a3b8" : "#64748b",
                      precision: 0,
                    },
                  },
                },
              }}
            />
          </div>
        </ChartPanel>

        <ChartPanel className="charts-scatter-panel" icon={<Activity />} kicker="Scatter" title="Class load map" wide>
          <div className="charts-canvas">
            <Scatter
              data={scatterData}
              options={{
                ...commonOptions,
                scales: {
                  ...commonOptions.scales,
                  x: {
                    ...commonOptions.scales.x,
                    min: 0,
                    max: rows.length + 1,
                    ticks: { ...commonOptions.scales.x.ticks, stepSize: 1 },
                  },
                },
              }}
            />
          </div>
        </ChartPanel>

        <ChartPanel className="charts-latency-panel" icon={<Broadcast />} kicker="Latency" title="MQTT latency area" wide>
          <div className="charts-canvas">
            <Line
              data={{
                labels: detectionHistory.map((item) => item.label),
                datasets: [
                  {
                    label: "MQTT latency",
                    data: detectionHistory.map((item) => item.mqttLatencyMs),
                    borderColor: "#0891b2",
                    backgroundColor: "rgba(8, 145, 178, 0.16)",
                    fill: true,
                    pointRadius: 3,
                    tension: 0.35,
                  },
                ],
              }}
              options={commonOptions}
            />
          </div>
        </ChartPanel>

        <ChartPanel className="charts-donut-panel" icon={<PieChart />} kicker="Donut" title="Total gear distribution">
          <div className="charts-canvas">
            <Doughnut
              data={{
                labels,
                datasets: [
                  {
                    data: totalCounts,
                    backgroundColor: labels.map((label, index) => getGearColor(label, index)),
                    borderColor: "#ffffff",
                    borderWidth: 3,
                  },
                ],
              }}
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
        </ChartPanel>

        <GaugeCard
          value={gaugeValue}
          activeTypes={detectionStats.activeTypes}
          trackedTypes={detectionStats.trackedTypes}
        />
      </section>
    </main>
  );
}

export default Charts;
