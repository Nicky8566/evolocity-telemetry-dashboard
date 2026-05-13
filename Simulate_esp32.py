"""
Simulates an ESP32 sending energy frames to the backend at 10Hz.
Run this while the backend server is running to test the full data pipeline.

Usage:
    python Simulate_esp32.py

The simulator repeats this power pattern:
  100W -> 400W -> 100W -> 2500W -> 100W
"""

import random
import time
from datetime import datetime, timezone
import requests

BACKEND_URL = "http://localhost:3001/api/data"
ECU_SERIAL  = 12345
INTERVAL    = 0.1    # 10Hz
NUM_SAMPLES = 10

POWER_SEQUENCE_W = [100, 400, 100, 2500, 100]
FRAMES_PER_POWER = 50


def adc_samples(center_mv: float, spread_mv: float) -> list[int]:
    """Voltage in millivolts; backend scales these to volts."""
    return [
        max(0, min(3300, int(center_mv + random.uniform(-spread_mv, spread_mv))))
        for _ in range(NUM_SAMPLES)
    ]


def current_samples(center_ma: float) -> list[float]:
    return [
        round(center_ma, 3)
        for _ in range(NUM_SAMPLES)
    ]


def frame(target_power_w: float) -> dict:
    """
    Backend scaling:
      voltage = millivolts / 1000
      current = milliamps / 1000
      power = avg_voltage * avg_current
    """
    v_samples = adc_samples(center_mv=2250, spread_mv=30)
    avg_voltage = sum(v_samples) / len(v_samples) / 1000
    target_current_ma = (target_power_w / avg_voltage) * 1000
    i_samples = current_samples(target_current_ma)

    return {
        "ecu_serial":      ECU_SERIAL,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "voltage_samples": v_samples,
        "current_samples": i_samples,
    }


def send_frame(target_power_w: float):
    payload = frame(target_power_w)
    try:
        resp  = requests.post(BACKEND_URL, json=payload, timeout=2)
        response_frame = resp.json().get("frame", {})
        v     = response_frame.get("avg_voltage", 0)
        i     = response_frame.get("avg_current", 0)
        p     = response_frame.get("avg_power",   0)
        e     = response_frame.get("avg_energy",  0)
        print(
            f"target={target_power_w:6.1f}W  "
            f"V={v:5.1f}V  "
            f"I={i:7.2f}A  "
            f"P={p:6.1f}W  "
            f"E={e:.5f}Wh  "
            f"status={resp.status_code}"
        )
    except requests.exceptions.RequestException as ex:
        print(f"Request failed: {ex}")


if __name__ == "__main__":
    print(f"Simulating ESP32  serial={ECU_SERIAL}  ->  {BACKEND_URL}")
    print(f"Power sequence: {'W -> '.join(str(power) for power in POWER_SEQUENCE_W)}W")
    print("Press Ctrl+C to stop\n")

    while True:
        for target_power_w in POWER_SEQUENCE_W:
            for _ in range(FRAMES_PER_POWER):
                send_frame(target_power_w)
                time.sleep(INTERVAL)
