"""
Simulates an ESP32 sending energy frames to the backend at 10 Hz.

This v3 profile is based on Simulate_esp32_v2.py, but it produces staged
telemetry: voltage and current sit at discrete levels for 20 seconds with
small jitter, and current can occasionally be negative. Power is calculated
from the jittered voltage/current samples, so it follows the same levels.

Frame accuracy vs real firmware (esp-firmware/main/network.c, config.h, storage.c):
  timestamp       - int ms since start  (FreeRTOS xTaskGetTickCount * portTICK_PERIOD_MS,
                                         NOT a wall-clock ISO string)
  voltage_samples - 10 ints in mV       (real ESP: int, VOLTAGE_GAIN = 19.9x applied)
  current_samples - 10 ints in mA       (real ESP: int, from mv_to_current_ma() integer math)
  power_samples   - 10 ints in mW       (real ESP: int, (voltage_mv * current_ma) / 1000,
                                         integer division, result in milliwatts NOT watts)
  ecu_serial      - 2                   (config.h: #define ecu_serial 2)

Offline simulation:
  The simulator drives its own online/offline cycle - no need to kill the backend.
  While offline, frames are written to a local buffer (mirroring SPIFFS flash storage on
  the real ESP; capacity ~11 900 batches ~= 1 MB / 128 bytes per batch).
  On reconnection, a background thread (mirroring flush_task + storage_flush_to_server()
  in main.c / storage.c) drains the buffer oldest-first as fast as possible, while the
  main loop simultaneously resumes sending live frames at 10 Hz.

Usage:
    python Simulate_esp32_v4.py
"""

import collections
import random
import threading
import time

import requests

# ---------------------------------------------------------------------------
# Connection / server
# ---------------------------------------------------------------------------
BACKEND_URL = "http://localhost:3001/api/data"
ECU_SERIAL  = 4      # config.h: #define ecu_serial 4

# ---------------------------------------------------------------------------
# Sampling
# ---------------------------------------------------------------------------
NUM_SAMPLES       = 10     # config.h: #define BATCH_SIZE 10
SAMPLE_INTERVAL_S = 0.1    # 10 Hz - one batch per 100 ms

# ---------------------------------------------------------------------------
# Discrete telemetry levels
# ---------------------------------------------------------------------------
LEVEL_DURATION_S = 20.0
VOLTAGE_JITTER_V = 0.1
CURRENT_JITTER_A = 0.1

# (voltage_V, current_A). Negative current levels simulate regen/backfeed.
LEVELS = [
    (24.0,  0.0),
    (24.0,  4.0),
    (36.0,  8.0),
    (48.0, 12.0),
    (52.0, 18.0),
    (48.0, -2.5),
    (36.0,  3.0),
    (30.0, -1.0),
]

# ---------------------------------------------------------------------------
# Offline simulation parameters
# ---------------------------------------------------------------------------
ONLINE_DURATION_S  = 30.0
OFFLINE_DURATION_S = 20.0
MAX_BUFFER_FRAMES  = 11_900

# ---------------------------------------------------------------------------
# Timestamp reference - mirrors FreeRTOS scheduler start on real device.
# ---------------------------------------------------------------------------
_boot_ms    = int(time.monotonic() * 1000)
_print_lock = threading.Lock()
_level_index = -1
_level_until = 0.0
_level_voltage_v = LEVELS[0][0]
_level_current_a = LEVELS[0][1]


def timestamp_ms() -> int:
    """ms since simulator start - matches xTaskGetTickCount * portTICK_PERIOD_MS."""
    return int(time.monotonic() * 1000) - _boot_ms


def current_level() -> tuple[float, float]:
    """Return the active 20-second voltage/current level."""
    global _level_index, _level_until, _level_voltage_v, _level_current_a

    now = time.monotonic()
    if now < _level_until:
        return _level_voltage_v, _level_current_a

    _level_index = (_level_index + 1) % len(LEVELS)
    _level_voltage_v, _level_current_a = LEVELS[_level_index]
    _level_until = now + LEVEL_DURATION_S
    with _print_lock:
        print(
            f"\n[SIM] New 20 s level: "
            f"V={_level_voltage_v:.1f} V  I={_level_current_a:.1f} A\n"
        )
    return _level_voltage_v, _level_current_a


def jittered_mv(voltage_v: float) -> int:
    return int(round((voltage_v + random.uniform(-VOLTAGE_JITTER_V, VOLTAGE_JITTER_V)) * 1000))


def jittered_ma(current_a: float) -> int:
    return int(round((current_a + random.uniform(-CURRENT_JITTER_A, CURRENT_JITTER_A)) * 1000))


def build_frame() -> dict:
    """
    Voltage/current stay at discrete levels for 20 s, with tiny sample jitter.
    Power is calculated as mV * mA / 1000 = mW and can be negative when current
    is negative.
    """
    voltage_v, current_a = current_level()
    v = [jittered_mv(voltage_v) for _ in range(NUM_SAMPLES)]
    i = [jittered_ma(current_a) for _ in range(NUM_SAMPLES)]
    p = [int((v_ * i_) / 1000) for v_, i_ in zip(v, i)]
    return {
        "ecu_serial":      ECU_SERIAL,
        "timestamp":       timestamp_ms(),
        "voltage_samples": v,
        "current_samples": i,
        "power_samples":   p,
    }


def try_send(session: requests.Session, frame: dict) -> bool:
    try:
        r = session.post(BACKEND_URL, json=frame, timeout=2)
        return r.ok
    except requests.exceptions.RequestException:
        return False


def fmt_frame(frame: dict, tag: str = "") -> str:
    avg_v = sum(frame["voltage_samples"]) / NUM_SAMPLES / 1000
    avg_i = sum(frame["current_samples"]) / NUM_SAMPLES / 1000
    avg_p = sum(frame["power_samples"])   / NUM_SAMPLES / 1000
    suffix = f"  [{tag}]" if tag else ""
    return (
        f"t={frame['timestamp']:>8} ms  "
        f"V={avg_v:5.1f} V  "
        f"I={avg_i:6.2f} A  "
        f"P={avg_p:7.1f} W"
        f"{suffix}"
    )


def flush_worker(
    buffer: collections.deque,
    lock: threading.Lock,
) -> None:
    """
    Background thread: drains buffered frames as fast as possible (no rate limit)
    while the main loop simultaneously sends live frames at 10 Hz.
    """
    session = requests.Session()

    with lock:
        total = len(buffer)

    with _print_lock:
        print(f"\n  --> Background flush started: {total} frames "
              f"({total * SAMPLE_INTERVAL_S:.1f} s of data)\n")

    while True:
        with lock:
            if not buffer:
                break
            frame = buffer.popleft()

        if try_send(session, frame):
            with lock:
                remaining = len(buffer)
            with _print_lock:
                print(fmt_frame(frame, f"FLUSH  {remaining} left"))
            time.sleep(0.005)
        else:
            with lock:
                buffer.appendleft(frame)
            with _print_lock:
                print("  --> Backend unreachable mid-flush. "
                      f"{len(buffer)} frames remain for next reconnection.\n")
            return

    with _print_lock:
        print("\n  --> Flush complete.\n")


def main():
    buffer       = collections.deque(maxlen=MAX_BUFFER_FRAMES)
    buffer_lock  = threading.Lock()
    session      = requests.Session()
    flush_thread: threading.Thread | None = None

    sim_online = True
    phase_end  = time.monotonic() + ONLINE_DURATION_S

    print(f"ESP32 simulator v3  ecu_serial={ECU_SERIAL}  ->  {BACKEND_URL}")
    print(f"Signal: discrete {LEVEL_DURATION_S:.0f} s levels, "
          f"+/-{VOLTAGE_JITTER_V:.1f} V and +/-{CURRENT_JITTER_A:.1f} A jitter")
    print(f"Cycle: {ONLINE_DURATION_S:.0f} s online  "
          f"->  {OFFLINE_DURATION_S:.0f} s offline  "
          f"->  flush (background) + live (10 Hz)  ->  repeat")
    print(f"Buffer: {MAX_BUFFER_FRAMES} frames = "
          f"{MAX_BUFFER_FRAMES * SAMPLE_INTERVAL_S / 60:.0f} min  "
          f"(mirrors SPIFFS ~1 MB flash on real ESP)\n")

    while True:
        loop_start = time.monotonic()

        if time.monotonic() >= phase_end:
            if sim_online:
                sim_online = False
                phase_end  = time.monotonic() + OFFLINE_DURATION_S
                with _print_lock:
                    print(f"\n[SIM] Going offline for {OFFLINE_DURATION_S:.0f} s  "
                          f"(buffer capacity: {MAX_BUFFER_FRAMES} frames)\n")
            else:
                sim_online = True
                phase_end  = time.monotonic() + ONLINE_DURATION_S
                with _print_lock:
                    buf_len = len(buffer)
                    if buf_len:
                        print(f"\n[SIM] Reconnected - resuming live stream AND flushing "
                              f"{buf_len} buffered frames simultaneously")
                    else:
                        print(f"\n[SIM] Reconnected - buffer empty, resuming live stream\n")

                if buffer and (flush_thread is None or not flush_thread.is_alive()):
                    flush_thread = threading.Thread(
                        target=flush_worker,
                        args=(buffer, buffer_lock),
                        daemon=True,
                        name="flush",
                    )
                    flush_thread.start()

        frame = build_frame()

        if sim_online:
            sent     = try_send(session, frame)
            flushing = flush_thread is not None and flush_thread.is_alive()
            if sent:
                tag = "live + flushing" if flushing else "live"
            else:
                tag = "SEND FAILED - backend down?"
            with _print_lock:
                print(fmt_frame(frame, tag))
        else:
            with buffer_lock:
                dropped  = len(buffer) == MAX_BUFFER_FRAMES
                buffer.append(frame)
                buf_size = len(buffer)
            countdown = max(0.0, phase_end - time.monotonic())
            tag = (
                f"OFFLINE  reconnect in {countdown:5.1f} s  "
                + ("BUFFER FULL - dropping oldest" if dropped
                   else f"buffered {buf_size}/{MAX_BUFFER_FRAMES}")
            )
            with _print_lock:
                print(fmt_frame(frame, tag))

        elapsed = time.monotonic() - loop_start
        time.sleep(max(0.0, SAMPLE_INTERVAL_S - elapsed))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")