"""
Simulates an ESP32 sending energy frames to the backend every 0.1 seconds.
Run this while the backend server is running to test the data pipeline.

Usage:
    python simulate_esp32.py
"""

import random
import time
from datetime import datetime, timezone
import requests

BACKEND_URL = "http://localhost:3001/api/data"   # fixed to match our Express backend
ECU_SERIAL = 12345
INTERVAL = 0.1   # seconds
NUM_SAMPLES = 10  # ADC samples per frame


def random_adc_samples(center: int, spread: int) -> list[int]:
    return [
        max(0, min(3300, center + random.randint(-spread, spread)))
        for _ in range(NUM_SAMPLES)
    ]

def random_current_samples(center: float, spread: float) -> list[float]:
    return [
        round(center + random.uniform(-spread, spread), 3)
        for _ in range(NUM_SAMPLES)
    ]


def send_frame():
    # Simulate voltage in millivolts (0-3300 mV = 0-3.3V ADC range)
    voltage_samples = random_adc_samples(center=2250, spread=50)
    current_samples = random_current_samples(center=2, spread=1)
    time_ms = random_adc_samples(center=2250, spread=50)

    payload = {
        "ecu_serial": ECU_SERIAL,
        "timestamp": 220000,
        "voltage_samples": voltage_samples,
        "current_samples": current_samples,
    }

    try:
        resp = requests.post(BACKEND_URL, json=payload, timeout=2)
        avg_v = resp.json().get("frame", {}).get("avg_voltage", 0)
        print(f"[{payload['timestamp']}] status={resp.status_code} | avg_voltage={avg_v:.2f}V")
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")


if __name__ == "__main__":
    print(f"Simulating ESP32 (serial={ECU_SERIAL}) → {BACKEND_URL}")
    print("Press Ctrl+C to stop\n")

    while True:
        send_frame()
        time.sleep(INTERVAL)