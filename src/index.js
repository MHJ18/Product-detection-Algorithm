import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/poppins";
import "@fontsource/jetbrains-mono";
import "./index.css";
import App from "./App";
import "bootstrap/dist/css/bootstrap.min.css";
import DashboardState from "./Context/DashboardState";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <DashboardState>
      <App />
    </DashboardState>
  </React.StrictMode>
);
