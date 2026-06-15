import React from "react";
import { useNavigate } from "react-router-dom";
import { TypeAnimation } from "react-type-animation";
import cctvIcon from "../../assets/images/cctv.png";
import "./IoTLandingPage.css";
import { IoIosArrowRoundForward } from "react-icons/io";
function IoTLandingPage() {
  const navigate = useNavigate();

  return (
    <div className="iot-landing-container">
      <div className="iot-content">
        <div className="cctv-icon-container">
          <img src={cctvIcon} alt="CCTV" className="cctv-icon" />
        </div>
        <div className="iot-text-container">
          <h1 className="iot-text">
            <span className="iot-letter">I</span>
            <span className="iot-letter">O</span>
            <span className="iot-letter">T</span>
          </h1>
          <div className="light-beam"></div>
        </div>
        <TypeAnimation
          sequence={[
            "",
            1000,
            "Connecting devices, data, and people to create a smarter, more efficient world through Internet of Things technology.",
            1000,
          ]}
          wrapper="p"
          className="iot-description"
          cursor={true}
          repeat={0}
        />
        <button
          className="iot-explore-btn"
          onClick={() => navigate("/home")}
        >
          Open Home <IoIosArrowRoundForward size={26} color="#ffffff" />
        </button>
      </div>
    </div>
  );
}

export default IoTLandingPage;
