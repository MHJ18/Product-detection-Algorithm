import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BellFill,
  BoxArrowRight,
  CheckCircleFill,
  ChevronDown,
  ExclamationTriangleFill,
  GearFill,
  Grid1x2Fill,
  List,
  MoonStars,
  PersonCircle,
  ShieldCheck,
  Sun,
  Terminal,
  Wifi,
  WifiOff,
} from "react-bootstrap-icons";
import Context from "../../Context/DashboardContext";
import "./header.css";

function formatHeaderTime(timestamp) {
  if (!timestamp) {
    return "Waiting";
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Header() {
  const {
    alerts,
    appSettings,
    appRunMode,
    cameraFeedConnected,
    changeAppRunMode,
    changeThemeMode,
    connectionStatus,
    detectionStats,
    eventLog,
    feedStatus,
    latestPacket,
    mode,
    websocketUrl,
  } = useContext(Context);
  const [openMenu, setOpenMenu] = useState(null);
  const headerRef = useRef(null);
  const feedLive = feedStatus === "live";
  const demoMode = appRunMode === "demo";
  const alertCount = alerts?.length || 0;

  const notificationItems = useMemo(() => {
    if (alertCount > 0) {
      return alerts.map((alert, index) => ({
        id: `alert-${index}`,
        level: alert.level || "info",
        message: alert.message,
        time: "Now",
        title: alert.title,
      }));
    }

    return (eventLog || []).slice(0, 4).map((event) => ({
      id: event.id,
      level: event.type === "error" ? "critical" : "info",
      message: event.message,
      time: formatHeaderTime(event.timestamp),
      title: event.type,
    }));
  }, [alertCount, alerts, eventLog]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleSidebar = () => {
    const app = document.querySelector(".App");

    if (window.matchMedia("(max-width: 900px)").matches) {
      app?.classList.toggle("mobile-sidebar-open");
      return;
    }

    app?.classList.toggle("closed-sidebar");
  };

  return (
    <header className={`softcity-header ${mode}`} ref={headerRef}>
      <div className="header-left">
        <button
          aria-label="Toggle sidebar"
          className="header-icon-button"
          type="button"
          onClick={toggleSidebar}
        >
          <List />
        </button>

        <Link className="header-brand" to="/">
          <Grid1x2Fill />
          <span>SoftCity Vision</span>
        </Link>
      </div>

      <div className="header-actions">
        <div className={`header-status ${feedLive ? "connected" : "disconnected"}`}>
          {feedLive ? <Wifi /> : <WifiOff />}
          <span>{feedLive ? "Live" : "Waiting"}</span>
        </div>
        <button
          aria-checked={demoMode}
          className={`header-mode-switch ${demoMode ? "demo" : "real"}`}
          onClick={() => changeAppRunMode(demoMode ? "real" : "demo")}
          role="switch"
          type="button"
        >
          <span className="header-mode-option">Real</span>
          <span className="header-mode-option">Demo</span>
          <span className="header-mode-thumb" />
          <span className="sr-only">Toggle app mode</span>
        </button>
        <button
          aria-label="Toggle theme"
          className="header-icon-button"
          type="button"
          onClick={() => changeThemeMode(mode === "dark-mode" ? "light-mode" : "dark-mode")}
        >
          {mode === "dark-mode" ? <Sun /> : <MoonStars />}
        </button>
        <div className="header-menu-shell">
          <button
            aria-expanded={openMenu === "notifications"}
            aria-haspopup="menu"
            aria-label="Notifications"
            className="header-icon-button notification-button"
            type="button"
            onClick={() => setOpenMenu((current) => (current === "notifications" ? null : "notifications"))}
          >
            <BellFill />
            {alertCount > 0 && <span className="notification-dot" />}
          </button>

          {openMenu === "notifications" && (
            <section className="header-dropdown notification-dropdown" role="menu">
              <div className="header-dropdown-title">
                <div>
                  <p>Action Center</p>
                  <h2>{alertCount > 0 ? `${alertCount} item${alertCount > 1 ? "s" : ""}` : "Recent activity"}</h2>
                </div>
                <Link to="/event-log" onClick={() => setOpenMenu(null)}>
                  View log
                </Link>
              </div>

              <div className="header-notification-list">
                {notificationItems.length > 0 ? (
                  notificationItems.map((item) => (
                    <article className={`header-notification ${item.level}`} key={item.id}>
                      <div className="header-notification-icon">
                        {item.level === "critical" || item.level === "warning" ? (
                          <ExclamationTriangleFill />
                        ) : (
                          <CheckCircleFill />
                        )}
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.message}</span>
                        <small>{item.time}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="header-notification empty">
                    <div className="header-notification-icon">
                      <CheckCircleFill />
                    </div>
                    <div>
                      <strong>System ready</strong>
                      <span>No alerts or recent events are waiting.</span>
                      <small>{formatHeaderTime(latestPacket?.receivedAt)}</small>
                    </div>
                  </article>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="header-menu-shell">
          <button
            aria-expanded={openMenu === "admin"}
            aria-haspopup="menu"
            className="header-admin-button"
            type="button"
            onClick={() => setOpenMenu((current) => (current === "admin" ? null : "admin"))}
          >
            <PersonCircle />
            <span>
              <strong>Admin</strong>
              <small>{appRunMode === "demo" ? "Simulation" : "Real feed"}</small>
            </span>
            <ChevronDown />
          </button>

          {openMenu === "admin" && (
            <section className="header-dropdown admin-dropdown" role="menu">
              <div className="admin-profile-card">
                <PersonCircle />
                <div>
                  <h2>Hassaan Admin</h2>
                  <p>Vision system operator</p>
                </div>
              </div>

              <div className="admin-snapshot-grid">
                <div>
                  <span>Mode</span>
                  <strong>{appRunMode === "demo" ? "Simulation" : "Real"}</strong>
                </div>
                <div>
                  <span>Classes</span>
                  <strong>{detectionStats?.trackedTypes || 0}</strong>
                </div>
                <div>
                  <span>Camera</span>
                  <strong>{cameraFeedConnected ? "Online" : "Waiting"}</strong>
                </div>
                <div>
                  <span>Bridge</span>
                  <strong>{connectionStatus}</strong>
                </div>
              </div>

              <div className="admin-readout">
                <span>WebSocket</span>
                <code>{websocketUrl}</code>
              </div>
              <div className="admin-readout">
                <span>MQTT</span>
                <code>{appSettings?.mqttBrokerUrl || "mqtt://test.mosquitto.org:1883"}</code>
              </div>

              <nav className="admin-menu-links" aria-label="Admin quick links">
                <Link to="/settings" onClick={() => setOpenMenu(null)}>
                  <GearFill />
                  Settings
                </Link>
                <Link to="/mqtt-cli" onClick={() => setOpenMenu(null)}>
                  <Terminal />
                  MQTT CLI
                </Link>
                <Link to="/event-log" onClick={() => setOpenMenu(null)}>
                  <ShieldCheck />
                  Event log
                </Link>
              </nav>

              <button className="admin-session-button" type="button" disabled>
                <BoxArrowRight />
                Local operator session
              </button>
            </section>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
