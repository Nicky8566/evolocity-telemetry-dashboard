"""
Simulates an ESP32 sending energy frames to the backend at 10 Hz.

Consolidates v3 (random telemetry) and v4 (staged discrete levels) into one
script with adjustable parameters.  Select a mode by setting SIGNAL_MODE below.

Frame accuracy vs real firmware (esp-firmware/main/network.c, config.h, storage.c):
  timestamp       — int ms since Unix epoch  (captured once at boot via time.time(), then
                                               advanced using monotonic elapsed time so
                                               time.time() is never called per-frame)
  voltage_samples — 10 ints in mV       (real ESP: int, VOLTAGE_GAIN = 19.9x applied)
  current_samples — 10 ints in mA       (real ESP: int, from mv_to_current_ma() integer math)
  power_samples   — 10 ints in mW       (real ESP: int, (voltage_mv * current_ma) / 1000 —
                                          integer division, result in milliwatts NOT watts)
  ecu_serial      — configurable        (config.h: #define ecu_serial N)

Offline simulation:
  The simulator drives its own online/offline cycle — no need to kill the backend.
  While offline, frames are written to a local buffer (mirroring SPIFFS flash storage on
  the real ESP; capacity ~11 900 batches ≈ 1 MB / 128 bytes per batch).
  On reconnection, a background thread (mirroring flush_task + storage_flush_to_server()
  in main.c / storage.c) drains the buffer oldest-first as fast as possible, while the
  main loop simultaneously resumes sending live frames at 10 Hz.

Modes:
  "random"  — voltage and current drawn from uniform random ranges each sample.
  "staged"  — discrete voltage/current levels held for LEVEL_DURATION_S seconds with
               small jitter; supports negative current to simulate regen/backfeed.

Usage:
    python Simulate_esp32_v3.py
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
ECU_SERIAL  = 3      # config.h: #define ecu_serial N

# ---------------------------------------------------------------------------
# Sampling
# ---------------------------------------------------------------------------
NUM_SAMPLES       = 10     # config.h: #define BATCH_SIZE 10
SAMPLE_INTERVAL_S = 0.1    # 10 Hz — one batch per 100 ms

# ---------------------------------------------------------------------------
# Signal mode — "random" or "staged"
# ---------------------------------------------------------------------------
SIGNAL_MODE = "staged"

# ── Random mode parameters ──────────────────────────────────────────────────
VOLTAGE_RANGE_MV = (20_000, 58_000)   # uniform range for each voltage sample (mV)
CURRENT_RANGE_MA = (0, 30_000)        # uniform range for each current sample (mA)

# ── Staged mode parameters ──────────────────────────────────────────────────
LEVEL_DURATION_S = 20.0    # seconds each (voltage, current) level is held
VOLTAGE_JITTER_V = 0.1     # +/- V jitter per sample
CURRENT_JITTER_A = 0.1     # +/- A jitter per sample (can expose negative current at low levels)

# (voltage_V, current_A) — negative current simulates regen / backfeed
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
ONLINE_DURATION_S  = 30.0    # seconds to stream normally before simulating a disconnect
OFFLINE_DURATION_S = 20.0    # seconds to stay offline and buffer before reconnecting
MAX_BUFFER_FRAMES  = 11_900  # mirrors SPIFFS capacity: ~1 MB / 128 bytes per batch_t

# ---------------------------------------------------------------------------
# Timestamp reference — epoch ms captured once at boot; all subsequent
# timestamps are derived as _epoch_ref_ms + (monotonic_now - _mono_ref_ms)
# so that time.time() (a wall-clock syscall) is never called per-frame.
# ---------------------------------------------------------------------------
_epoch_ref_ms = int(time.time() * 1000)       # wall-clock anchor (ms since Unix epoch)
_mono_ref_ms  = int(time.monotonic() * 1000)  # monotonic anchor taken at the same instant
_print_lock   = threading.Lock()

# Staged mode state
_level_index    = -1
_level_until    = 0.0
_level_voltage_v = LEVELS[0][0]
_level_current_a = LEVELS[0][1]


def timestamp_ms() -> int:
    """Current Unix epoch in ms, derived from a single wall-clock sample taken at boot."""
    elapsed_ms = int(time.monotonic() * 1000) - _mono_ref_ms
    return _epoch_ref_ms + elapsed_ms


def _next_level() -> tuple[float, float]:
    """Advance to the next staged level when the current one expires."""
    global _level_index, _level_until, _level_voltage_v, _level_current_a
    now = time.monotonic()
    if now < _level_until:
        return _level_voltage_v, _level_current_a
    _level_index = (_level_index + 1) % len(LEVELS)
    _level_voltage_v, _level_current_a = LEVELS[_level_index]
    _level_until = now + LEVEL_DURATION_S
    with _print_lock:
        print(f"\n[SIM] New {LEVEL_DURATION_S:.0f} s level: "
              f"V={_level_voltage_v:.1f} V  I={_level_current_a:.1f} A\n")
    return _level_voltage_v, _level_current_a


def build_frame() -> dict:
    if SIGNAL_MODE == "staged":
        voltage_v, current_a = _next_level()
        v = [int(round((voltage_v + random.uniform(-VOLTAGE_JITTER_V, VOLTAGE_JITTER_V)) * 1000))
             for _ in range(NUM_SAMPLES)]
        i = [int(round((current_a + random.uniform(-CURRENT_JITTER_A, CURRENT_JITTER_A)) * 1000))
             for _ in range(NUM_SAMPLES)]
    else:
        v = [int(random.uniform(*VOLTAGE_RANGE_MV)) for _ in range(NUM_SAMPLES)]
        i = [int(random.uniform(*CURRENT_RANGE_MA)) for _ in range(NUM_SAMPLES)]

    p = [int((v_ * i_) / 1000) for v_, i_ in zip(v, i)]  # mV * mA / 1000 = mW
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
        f"t={frame['timestamp']}  "
        f"V={avg_v:5.1f} V  "
        f"I={avg_i:6.2f} A  "
        f"P={avg_p:7.1f} W"
        f"{suffix}"
    )


def flush_worker(buffer: collections.deque, lock: threading.Lock) -> None:
    """
    Background thread: drains buffered frames as fast as possible (no rate limit)
    while the main loop simultaneously sends live frames at 10 Hz.

    Uses its own requests.Session so its connection pool is completely independent
    of the main loop's session — mirroring how the real ESP32 flush_task and live
    send task each own a separate TCP socket and never contend for the same
    connection.

    Frames are sent oldest-first.  If the backend becomes unreachable mid-flush,
    the frame is returned to the front of the buffer and the flush stops — the
    remaining frames will be retried on the next reconnection cycle.
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
            # Yield the GIL between dump frames so the live-send thread gets
            # guaranteed CPU windows.  Without this sleep the flush thread's
            # rapid socket calls hold the GIL almost continuously, starving the
            # live thread and causing its try_send to time out.
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

    print(f"ESP32 simulator v3  ecu_serial={ECU_SERIAL}  mode={SIGNAL_MODE}  ->  {BACKEND_URL}")
    print(f"Epoch reference: {_epoch_ref_ms} ms  (captured once at boot)")
    if SIGNAL_MODE == "staged":
        print(f"Signal: discrete {LEVEL_DURATION_S:.0f} s levels, "
              f"+/-{VOLTAGE_JITTER_V:.2f} V and +/-{CURRENT_JITTER_A:.2f} A jitter")
    else:
        print(f"Signal: random  V={VOLTAGE_RANGE_MV[0]//1000}-{VOLTAGE_RANGE_MV[1]//1000} V  "
              f"I={CURRENT_RANGE_MA[0]//1000}-{CURRENT_RANGE_MA[1]//1000} A")
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
                        print(f"\n[SIM] Reconnected — resuming live stream AND flushing "
                              f"{buf_len} buffered frames simultaneously")
                    else:
                        print(f"\n[SIM] Reconnected — buffer empty, resuming live stream\n")

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
                tag = "SEND FAILED — backend down?"
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
                + ("BUFFER FULL — dropping oldest" if dropped
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
