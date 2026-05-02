"""
Simulates an ESP32 sending energy frames to the backend at 10Hz.
Run this while the backend server is running to test the full data pipeline.

Usage:
    python Simulate_esp32.py

The simulator alternates between three modes:
  - Normal  : ~100W  (well under the 350W standard class limit)
  - Warning : ~320W  (just under limit — tests 90% warning threshold)
  - Penalty : ~420W  (over limit — tests breach detection and escalation)
"""

import random
import time
from datetime import datetime, timezone
import requests

BACKEND_URL = "http://localhost:3001/api/data"
ECU_SERIAL  = 12345
INTERVAL    = 0.1    # 10Hz
NUM_SAMPLES = 10

# Cycle: 50 normal frames → 8 warning frames → 15 penalty frames → repeat
# 15 penalty frames = 1.5s → triggers escalation to penalty at 1s mark
CYCLE = [
    ("normal",  50),
    ("warning",  8),
    ("penalty", 15),
]


def adc_samples(center_mv: float, spread_mv: float) -> list[int]:
    """Voltage in millivolts — backend scales these to real volts."""
    return [
        max(0, min(3300, int(center_mv + random.uniform(-spread_mv, spread_mv))))
        for _ in range(NUM_SAMPLES)
    ]


def current_samples(center_a: float, spread_a: float) -> list[float]:
    return [
        round(center_a + random.uniform(-spread_a, spread_a), 3)
        for _ in range(NUM_SAMPLES)
    ]


def frame_for_mode(mode: str) -> dict:
    """
    Voltage scaling: V_real = (mv / 1000) * 22.3
    center_mv=2250 → V_real ≈ 50V

    Target power levels:
      normal  ~100W  → I ≈ 2A   (50V × 2A)
      warning ~320W  → I ≈ 6.4A (50V × 6.4A, just under 350W limit)
      penalty ~420W  → I ≈ 8.4A (50V × 8.4A, over 350W limit)
    """
    v_samples = adc_samples(center_mv=2250, spread_mv=30)

    if mode == "normal":
        i_samples = current_samples(center_a=2.0, spread_a=0.3)
    elif mode == "warning":
        i_samples = current_samples(center_a=6.4, spread_a=0.2)
    else:  # penalty
        i_samples = current_samples(center_a=8.4, spread_a=0.3)

    return {
        "ecu_serial":      ECU_SERIAL,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "voltage_samples": v_samples,
        "current_samples": i_samples,
    }


def send_frame(mode: str):
    payload = frame_for_mode(mode)
    try:
        resp  = requests.post(BACKEND_URL, json=payload, timeout=2)
        frame = resp.json().get("frame", {})
        v     = frame.get("avg_voltage", 0)
        i     = frame.get("avg_current", 0)
        p     = frame.get("avg_power",   0)
        e     = frame.get("avg_energy",  0)
        print(
            f"[{mode:<7}] "
            f"V={v:5.1f}V  "
            f"I={i:4.2f}A  "
            f"P={p:6.1f}W  "
            f"E={e:.5f}Wh  "
            f"status={resp.status_code}"
        )
    except requests.exceptions.RequestException as ex:
        print(f"Request failed: {ex}")


if __name__ == "__main__":
    print(f"Simulating ESP32  serial={ECU_SERIAL}  →  {BACKEND_URL}")
    print("Cycle: 50 normal → 8 warning → 15 penalty → repeat")
    print("Press Ctrl+C to stop\n")

    while True:
        for mode, count in CYCLE:
            for _ in range(count):
                send_frame(mode)
                time.sleep(INTERVAL)
