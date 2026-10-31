"""Security unit tests for Hardware X-Device-Key authentication header."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_telemetry_post_rejects_missing_key():
    payload = {
        "turbidity_ntu": 8.0,
        "tds_ppm": 180.0,
        "temp_c": 24.5,
        "z_turb": 0.1,
        "z_tds": 0.1,
        "z_temp": 0.1,
        "anomaly_score": 0.2,
        "state": "NORMAL",
        "device_id": "test-node",
    }
    # No header sent
    response = client.post("/telemetry", json=payload)
    assert response.status_code == 401
    assert "Missing or invalid X-Device-Key" in response.json()["detail"]


def test_telemetry_post_rejects_invalid_key():
    payload = {
        "turbidity_ntu": 8.0,
        "tds_ppm": 180.0,
        "temp_c": 24.5,
        "z_turb": 0.1,
        "z_tds": 0.1,
        "z_temp": 0.1,
        "anomaly_score": 0.2,
        "state": "NORMAL",
        "device_id": "test-node",
    }
    # Wrong key
    headers = {"X-Device-Key": "fraudulent_spoofed_key_1234"}
    response = client.post("/telemetry", json=payload, headers=headers)
    assert response.status_code == 401


def test_telemetry_post_accepts_valid_key():
    payload = {
        "turbidity_ntu": 8.0,
        "tds_ppm": 180.0,
        "temp_c": 24.5,
        "z_turb": 0.1,
        "z_tds": 0.1,
        "z_temp": 0.1,
        "anomaly_score": 0.2,
        "state": "NORMAL",
        "device_id": "test-node",
    }
    # Valid key
    headers = {"X-Device-Key": "jal_sec_dev_local_key"}
    response = client.post("/telemetry", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["wqi"] >= 90.0
