# AquaSure: Multi-Sensor Water Quality Monitoring & Anomaly Detection System

[![Production Dashboard](https://img.shields.io/badge/Live_SCADA_PWA-jalrakshak--rosy.vercel.app-0284c7?style=flat&logo=vercel)](https://jalrakshak-rosy.vercel.app)
[![Standard](https://img.shields.io/badge/Compliance-BIS_IS_10500:2012-emerald?style=flat)](https://jalrakshak-rosy.vercel.app)
[![Telegram Bot](https://img.shields.io/badge/Alerts-@jalrakshak__test__bot-0088cc?style=flat&logo=telegram)](https://t.me/jalrakshak_test_bot)

AquaSure is an industrial-grade embedded IoT and edge-computing water monitoring system designed to detect chemical and physical anomalies in drinking water using an ESP32 microcontroller, optical nephelometric turbidity sensing, $EC_{25}$ compensated electrical conductivity (TDS), and high-precision fluid temperature measurement.

---

## 📚 Handover Documentation & Engineering Assets

* 📘 **[Operator Handbook & Field Troubleshooting Guide (PDF)](docs/OPERATOR_HANDBOOK.pdf)** — Operational procedures, sensor immersion depths, 3-cup demonstration script, and defense answers.
* 🏛️ **[Comprehensive Architecture & Engineering Manual (PDF)](docs/ENGINEERING_MANUAL.pdf)** — Full technical specifications, circuit pinouts, mathematical models, state machine hysteresis, and cloud database schema.
* 🖨️ **3D Printable Enclosure (CAD)**:
  * **[Base Chassis STL](docs/cad/jalrakshak_enclosure_base.stl)**
  * **[Top Cover / Lid STL](docs/cad/jalrakshak_enclosure_lid.stl)**
  * **[OpenSCAD Source Model](docs/cad/jalrakshak_enclosure.scad)**

---

## System Architecture

The project is structured as a **Containerized Microservices Monorepo**:

* **`firmware/`**: ESP32 C++ firmware (`firmware.ino`), handling 64x ADC multisampling, exponential moving average (EMA) low-pass filtering, $EC_{25}$ temperature compensation, Schmitt-trigger hysteresis state transitions, and 30-second continuous alarm qualification.
* **`services/dashboard-ui/`**: Responsive React 18 / Vite Progressive Web App (PWA) with serverless FastAPI backend, live WQI gauges (0–100), root-cause contaminant diagnosis, 1-click signed PDF inspection certificates, and remote buzzer muting.
* **`services/alert-worker/`**: Telemetry notification worker dispatching real-time mobile push notifications with IST timestamps via the Telegram Bot API.
* **`deploy/`**: Docker Compose orchestrator and Eclipse Mosquitto broker configuration for 1-command local startup.
* **`docs/`**: Production runbooks, CAD models, print-ready PDFs, and circuit wiring guides.

---

## Quick Start (Cloud & Hardware)

1. **Live Web App**: Navigate to [https://jalrakshak-rosy.vercel.app](https://jalrakshak-rosy.vercel.app) on any laptop, tablet, or smartphone.
2. **Mobile Installation**: Tap *"Add to Home Screen"* in Chrome/Edge/Safari to install as a native fullscreen PWA application.
3. **Hardware Deployment**: Plug the ESP32 into any standard 5V laptop USB port; connects via 2.4 GHz hotspot to stream live telemetry.

## Quick Start (Local Deployment)

### Prerequisites
* Docker Desktop installed and running
* Git

### 1-Command Startup
```bash
# 1. Clone the repository
git clone <repo-url>
cd jalrakshak

# 2. Configure environment secrets
cp deploy/.env.example deploy/.env
# Edit deploy/.env with your Telegram bot credentials

# 3. Launch all microservices
docker compose -f deploy/docker-compose.yml up -d
```

Open your browser:
* **Web Dashboard**: `http://localhost:3000`
* **Interactive API Docs**: `http://localhost:8000/docs`
* **MQTT Broker**: `localhost:1883`
