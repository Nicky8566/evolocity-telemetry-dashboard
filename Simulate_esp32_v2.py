"""
Simulates an ESP32 sending energy frames to the backend at 10 Hz.

Frame accuracy vs real firmware (esp-firmware/main/network.c, config.h, storage.c):
  timestamp       — int ms since start  (FreeRTOS xTaskGetTickCount * portTICK_PERIOD_MS,
                                          NOT a wall-clock ISO string)
  voltage_samples — 10 ints in mV       (real ESP: int, VOLTAGE_GAIN = 19.9x applied)
  current_samples — 10 ints in mA       (real ESP: int, from mv_to_current_ma() integer math)
  power_samples   — 10 ints in mW       (real ESP: int, (voltage_mv * current_ma) / 1000 —
                                          integer division, result in milliwatts NOT watts)
  ecu_serial      — 2                   (config.h: #define ecu_serial 2)

Offline simulation:
  The simulator drives its own online/offline cycle — no need to kill the backend.
  While offline, frames are written to a local buffer (mirroring SPIFFS flash storage on
  the real ESP; capacity ~11 900 batches ≈ 1 MB / 128 bytes per batch).
  On reconnection, a background thread (mirroring flush_task + storage_flush_to_server()
  in main.c / storage.c) drains the buffer oldest-first as fast as possible, while the
  main loop simultaneously resumes sending live frames at 10 Hz.

Usage:
    python Simulate_esp32_v2.py
"""

import collections
import random
import threading
import time

import requests

# ---------------------------------------------------------------------------
# Connection / server
# ---------------------------------------------------------------------------
BACKEND_URL       = "http://localhost:3001/api/data"
ECU_SERIAL        = 2      # config.h: #define ecu_serial 2

# ---------------------------------------------------------------------------
# Sampling
# ---------------------------------------------------------------------------
NUM_SAMPLES       = 10     # config.h: #define BATCH_SIZE 10
SAMPLE_INTERVAL_S = 0.1    # 10 Hz — one batch per 100 ms

# ---------------------------------------------------------------------------
# Offline simulation parameters
# ---------------------------------------------------------------------------
ONLINE_DURATION_S  = 30.0  # seconds to stream normally before simulating a disconnect
OFFLINE_DURATION_S = 20.0  # seconds to stay offline and buffer before reconnecting
MAX_BUFFER_FRAMES  = 11_900 # mirrors SPIFFS capacity: ~1 MB / 128 bytes per batch_t

# ---------------------------------------------------------------------------
# Timestamp reference — mirrors FreeRTOS scheduler start on real device.
# On the real ESP the first frame arrives several seconds after this point
# (NVS init + ADC init + WiFi association all happen before the first batch).
# ---------------------------------------------------------------------------
_boot_ms    = int(time.monotonic() * 1000)
_print_lock = threading.Lock()   # prevents interleaved output from live + flush threads


def timestamp_ms() -> int:
    """ms since simulator start — matches xTaskGetTickCount * portTICK_PERIOD_MS."""
    return int(time.monotonic() * 1000) - _boot_ms


def build_frame() -> dict:
    """
    Voltage: 20–58 V as integer mV  (Li pack; real ESP: ADC * VOLTAGE_GAIN=19.9, cast to int)
    Current: 0–30 A as integer mA   (unidirectional; real ESP: mv_to_current_ma() returns int)
    Power:   V*I as integer mW      (real ESP: (voltage_mv * current_ma) / 1000, integer division)
    """
    v = [int(random.uniform(20_000, 58_000)) for _ in range(NUM_SAMPLES)]
    i = [int(random.uniform(0,      30_000)) for _ in range(NUM_SAMPLES)]
    p = [(v_ * i_) // 1000 for v_, i_ in zip(v, i)]   # mV * mA / 1000 = mW, integer division
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
    avg_v = sum(frame["voltage_samples"]) / NUM_SAMPLES / 1000      # mV -> V
    avg_i = sum(frame["current_samples"]) / NUM_SAMPLES / 1000      # mA -> A
    avg_p = sum(frame["power_samples"])   / NUM_SAMPLES / 1000      # mW -> W
    suffix = f"  [{tag}]" if tag else ""
    return (
        f"t={frame['timestamp']:>8} ms  "
        f"V={avg_v:5.1f} V  "
        f"I={avg_i:5.2f} A  "
        f"P={avg_p:6.1f} W"
        f"{suffix}"
    )


def flush_worker(
    buffer: collections.deque,
    lock:   threading.Lock,
) -> None:
    """
    Background thread: drains buffered frames as fast as possible (no rate limit)
    while the main loop simultaneously sends live frames at 10 Hz.

    Uses its own requests.Session so its connection pool is completely independent
    of the main loop's session — mirroring how the real ESP32 flush_task and live
    send task each own a separate TCP socket and never contend for the same
    connection.

    Frames are sent oldest-first. If the backend becomes unreachable mid-flush,
    the frame is returned to the front of the buffer and the flush stops — the
    remaining frames will be retried on the next reconnection cycle.
    """
    session = requests.Session()   # independent pool — no contention with live thread

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
            # live thread and causing its try_send to time out (producing the
            # gap between dump-end and live-resume on the graph).
            # 5 ms matches real ESP32 behaviour where the flush task and live
            # task share CPU time via the RTOS scheduler.
            time.sleep(0.005)
        else:
            with lock:
                buffer.appendleft(frame)   # restore — will retry next reconnection
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

    print(f"ESP32 simulator  ecu_serial={ECU_SERIAL}  ->  {BACKEND_URL}")
    print(f"Cycle: {ONLINE_DURATION_S:.0f} s online  "
          f"->  {OFFLINE_DURATION_S:.0f} s offline  "
          f"->  flush (background) + live (10 Hz)  ->  repeat")
    print(f"Buffer: {MAX_BUFFER_FRAMES} frames = "
          f"{MAX_BUFFER_FRAMES * SAMPLE_INTERVAL_S / 60:.0f} min  "
          f"(mirrors SPIFFS ~1 MB flash on real ESP)\n")

    while True:
        loop_start = time.monotonic()

        # ---- phase transition -----------------------------------------------
        if time.monotonic() >= phase_end:
            if sim_online:
                # go offline
                sim_online = False
                phase_end  = time.monotonic() + OFFLINE_DURATION_S
                with _print_lock:
                    print(f"\n[SIM] Going offline for {OFFLINE_DURATION_S:.0f} s  "
                          f"(buffer capacity: {MAX_BUFFER_FRAMES} frames)\n")
            else:
                # reconnect
                sim_online = True
                phase_end  = time.monotonic() + ONLINE_DURATION_S
                with _print_lock:
                    buf_len = len(buffer)
                    if buf_len:
                        print(f"\n[SIM] Reconnected — resuming live stream AND flushing "
                              f"{buf_len} buffered frames simultaneously")
                    else:
                        print(f"\n[SIM] Reconnected — buffer empty, resuming live stream\n")

                # Start flush thread only if there is something to flush and
                # the previous flush thread (if any) has already finished.
                if buffer and (flush_thread is None or not flush_thread.is_alive()):
                    flush_thread = threading.Thread(
                        target=flush_worker,
                        args=(buffer, buffer_lock),
                        daemon=True,
                        name="flush",
                    )
                    flush_thread.start()

        # ---- sample and route frame -----------------------------------------
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
