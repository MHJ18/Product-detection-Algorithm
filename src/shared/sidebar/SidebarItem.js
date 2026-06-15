import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

function SidebarItem({ item }) {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const closeMobileSidebar = () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      document.querySelector(".App")?.classList.remove("mobile-sidebar-open");
    }
  };

  return (
    <div className="sidebar-items-parent">
      <Link
        to={item.path}
        className={`sidebar-item plain text-white ${isActive ? "active" : ""}`}
        onClick={closeMobileSidebar}
      >
        <div className="sidebar-title">
          <span className="menu-icon">{item.icon && <i className={item.icon}></i>}</span>
          <span className="menu-title closed-text">{item.title}</span>
        </div>
      </Link>
      <Outlet />
    </div>
  );
}

export default SidebarItem;
