# JalRakshak: Multi-Sensor Water Quality Monitoring & Anomaly Detection System

JalRakshak is an embedded IoT and edge-computing water monitoring system designed to detect anomalies in water quality using an ESP32 microcontroller, optical turbidity sensing, electrical conductivity (TDS), and high-precision fluid temperature measurement.

## System Architecture

The project is structured as a **Containerized Microservices Monorepo**:

* **`firmware/`**: ESP32 C++ firmware (PlatformIO), handling ADC oversampling, DS18B20 1-Wire, baseline statistical calibration, minimum scale guard ($s_{i,min}$), and MQTT Wi-Fi publishing.
* **`services/ingestion-api/`**: FastAPI (Python 3.11) microservice that subscribes to MQTT telemetry, validates schemas via Pydantic, calculates the 0–100 Water Quality Index (WQI), identifies the Contaminant Fingerprint, and exposes WebSocket and REST APIs (with auto-generated Swagger docs at `/docs`).
* **`services/alert-worker/`**: Lightweight Python service consuming alert events and dispatching real-time notifications to the client's phone via the Telegram Bot API.
* **`services/dashboard-ui/`**: Responsive React / Vite Progressive Web App (PWA) displaying live telemetry gauges, anomaly state badges, historical charts, and 1-click PDF inspection certificates.
* **`deploy/`**: Docker Compose orchestrator and Eclipse Mosquitto broker configuration for 1-command startup.
* **`docs/`**: Circuit schematics, wiring pinouts, and client handover runbooks.

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
