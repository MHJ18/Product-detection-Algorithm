import "./App.css";
import Header from "./shared/header/Header";
import Sidebar from "./shared/sidebar/Sidebar";

import AppRoutes from "./AppRoutes";
import { BrowserRouter as Router, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import DashboardContext from "./Context/DashboardContext";
import { useContext, useEffect } from "react";

function AppShell() {
  const menuMode = useContext(DashboardContext);
  const { appRunMode, mode } = menuMode;
  const location = useLocation();
  const isLanding = location.pathname === "/";
  const runModeClass = appRunMode === "demo" ? "app-demo-mode" : "app-real-mode";

  useEffect(() => {
    document.querySelector(".App")?.classList.remove("mobile-sidebar-open");

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.querySelector(".app-main__inner")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [location.pathname]);

  return (
    <div className={isLanding ? "App landing-only" : "App"}>
      {isLanding ? (
        <AppRoutes />
      ) : (
        <div className={`app-main ${mode || "light-mode"} ${runModeClass}`}>
          <Sidebar />
          <button
            aria-label="Close sidebar"
            className="mobile-sidebar-backdrop"
            onClick={() => document.querySelector(".App")?.classList.remove("mobile-sidebar-open")}
            type="button"
          />
          <div className="app-main__outer">
            <Header />
            <div className="app-main__inner">
              <AppRoutes />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const basename = process.env.PUBLIC_URL || "/";

  return (
    <Router basename={basename}>
      <AppShell />
    </Router>
  );
}

export default App;
