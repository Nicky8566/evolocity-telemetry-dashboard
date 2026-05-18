"""
Simulates an ESP32 sending energy frames to the backend at 10Hz.
Run this while the backend server is running to test the full data pipeline.

Usage:
    python Simulate_esp32.py
"""

import random
import time
from datetime import datetime, timezone
import requests

BACKEND_URL = "http://localhost:3001/api/data"
ECU_SERIAL  = 12345
INTERVAL    = 0.1    # 10Hz
NUM_SAMPLES = 10


def voltage_samples_mv() -> list[int]:
    """Random voltage between 13-60V, sent as millivolts to backend."""
    return [
        int(random.uniform(13000, 60000))
        for _ in range(NUM_SAMPLES)
    ]


def current_samples_ma() -> list[float]:
    """Random current between 1-3A, sent as milliamps to backend."""
    return [
        round(random.uniform(1000, 3000), 3)
        for _ in range(NUM_SAMPLES)
    ]


def build_frame() -> dict:
    v_samples = voltage_samples_mv()
    i_samples = current_samples_ma()

    # power_samples: P = V * I, scaling both to real units first
    p_samples = [
        round((v / 1000) * (i / 1000), 4)
        for v, i in zip(v_samples, i_samples)
    ]

    return {
        "ecu_serial":      ECU_SERIAL,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "voltage_samples": v_samples,
        "current_samples": i_samples,
        "power_samples":   p_samples,
    }


def send_frame():
    payload = build_frame()
    try:
        resp = requests.post(BACKEND_URL, json=payload, timeout=2)
        response_frame = resp.json().get("frame", {})
        v = response_frame.get("avg_voltage", 0)
        i = response_frame.get("avg_current", 0)
        p = v * i
        print(
            f"V={v:5.1f}V  "
            f"I={i:5.3f}A  "
            f"P={p:6.2f}W  "
            f"status={resp.status_code}"
        )
    except requests.exceptions.RequestException as ex:
        print(f"Request failed: {ex}")


if __name__ == "__main__":
    print(f"Simulating ESP32  serial={ECU_SERIAL}  ->  {BACKEND_URL}")
    print("Voltage: 13-60V (sent as mV) | Current: 1-3A (sent as mA) | Power: V*I")
    print("Press Ctrl+C to stop\n")

    while True:
        send_frame()
        time.sleep(INTERVAL)