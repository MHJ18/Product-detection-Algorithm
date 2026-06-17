import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import IoTLandingPage from "./pages/home/IoTLandingPage";
import Analytics from "./pages/analytics/Analytics";
import Settings from "./pages/settings/Settings";
import Charts from "./pages/charts/Charts";
import MqttCli from "./pages/mqttCli/MqttCli";
import {
  ArchitecturePage,
  EventLogPage,
} from "./pages/examTools/ExamTools";

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<IoTLandingPage />} />
        <Route path="/home" element={<Analytics />} />
        <Route path="/analytics" element={<Navigate to="/home" replace />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        <Route path="/event-log" element={<EventLogPage />} />
        <Route path="/mqtt-cli" element={<MqttCli />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default AppRoutes;
