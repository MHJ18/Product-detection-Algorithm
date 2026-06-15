import React, { useContext } from "react";

import items from "../../data/sidebar.json";
import SidebarItem from "./SidebarItem";
import logo from "../../assets/images/iot.png";

import "./sidebar.css";
import Context from "../../Context/DashboardContext";

const user = {
  name: "Hassaan",
  role: "Admin",
  image: "https://randomuser.me/api/portraits/men/32.jpg",
};

export default function Sidebar() {
  const menuMode = useContext(Context);
  const { mode } = menuMode;

  return (
    <>
      <div className={`app-sidebar ${mode} bg-dashboard text-white`}>
        <div className="sidebar-logo d-flex align-items-center justify-content-center p-3">
          <img
            src={logo}
            alt="Logo"
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "8px",
              filter: "invert(80%) hue-rotate(180deg)",
            }}
          />
        </div>
        <div className="sidebar" id="sidebar_softcity">
          {items.map((item, index) => (
            <SidebarItem key={index} item={item} mode={mode} />
          ))}
        </div>
        <div className="sidebar-user-profile">
          <img src={user.image} alt={`${user.name} profile`} />
          <div className="closed-text">
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
        </div>
      </div>
    </>
  );
}
