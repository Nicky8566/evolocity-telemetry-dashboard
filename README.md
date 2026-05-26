# EVolocity Race Day Dashboard

A wireless telemetry and race management system for the [EVolocity](https://evolocity.co.nz/) STEM program. ESP32-based energy monitors (ECUs) mounted on student electric vehicles stream live power data over WiFi to a central dashboard operated by race officials.

## What it does

- Receives live energy frames from one or more ESP32 ECUs at 10 Hz over WiFi
- Displays real-time voltage, current, and power charts per vehicle with a rolling time window
- Automatically detects and raises penalty alerts when a vehicle exceeds its power or current limit
- Closes breach alerts and applies penalties when a vehicle disconnects mid-breach
- Manages teams, competitions, run attempts (start/stop/DNF/DQ), and manual penalties
- Scores and ranks teams on a per-competition leaderboard
- Exports telemetry history to CSV

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, WebSocket (`ws`) |
| Database | SQLite via `sql.js` (persisted to disk) |
| Hardware | ESP32-DEVKITC-32E running custom firmware |
| Simulator | Python 3 (`Simulate_esp32_v3.py`) |

## Project structure

```
backend/          Express API + WebSocket server
  src/
    controllers/  Route handlers
    services/     Business logic (ECU processing, breach detection, scoring)
    database/     sql.js SQLite layer
    routes/       API route definitions

frontend/         React SPA
  src/
    pages/        Dashboard, EcuMonitor, Teams, Competitions, Alerts, Leaderboard
    components/   Reusable UI (ChartCard, RunControls, PenaltyList, modals…)
    context/      TelemetryContext — WebSocket connection + frame buffering
    api/          Typed fetch wrappers for each backend resource

Simulate_esp32_v3.py   ESP32 simulator (see below)
Simulate_esp32.py      Archived
Simulate_esp32_v2.py   Archived
```

## Getting started

**Prerequisites:** Node.js 18+, Python 3.10+

### Backend

```bash
cd backend
npm install
npm run dev        # starts on port 3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts on port 5173
```

### Simulator

Simulates one or more ESP32 devices sending frames to the backend.

```bash
python Simulate_esp32_v3.py --help          # full parameter list

# Examples
python Simulate_esp32_v3.py --serial 3
python Simulate_esp32_v3.py --serial 5 --mode staged --level-duration 10
python Simulate_esp32_v3.py --serial 2 --v-min 30 --v-max 50 --i-max 15
python Simulate_esp32_v3.py --serial 4 --offline --online-duration 20 --offline-duration 10
```

Key parameters:

| Flag | Default | Description |
|---|---|---|
| `--serial` | `3` | ECU serial number |
| `--mode` | `random` | `random` or `staged` signal |
| `--hz` | `10.0` | Transmit rate |
| `--v-min` / `--v-max` | `20` / `58` V | Voltage range (random mode) |
| `--i-min` / `--i-max` | `0` / `30` A | Current range (negative = regen) |
| `--offline` | off | Enable offline/reconnect cycle |
| `--online-duration` | `30` s | Seconds online before disconnecting |
| `--offline-duration` | `20` s | Seconds offline before reconnecting |

## ECU frame format

Frames are POST'd to `POST /api/data`:

```json
{
  "ecu_serial": 3,
  "timestamp": 1716800000000,
  "voltage_samples": [48210, 48190, ...],
  "current_samples": [8050, 8020, ...],
  "power_samples":   [387890, 387650, ...]
}
```

`timestamp` is Unix epoch milliseconds. Samples are in mV, mA, and mW respectively (10 samples per frame matching the 10 Hz rate).

## Key API endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/data` | Ingest an ECU frame |
| GET | `/api/ecu/history` | Fetch stored frames (filterable by serial / time) |
| GET | `/api/ecu/status` | Online/offline status per ECU |
| GET/POST | `/api/teams` | List / create teams |
| POST | `/api/runs/start` | Start a run attempt |
| POST | `/api/runs/:id/stop` | Stop a run with outcome |
| GET | `/api/competitions/:id/leaderboard` | Scored leaderboard |
| GET | `/api/alerts` | Active and resolved breach alerts |

Live telemetry is pushed over two WebSocket connections:
- `ws://localhost:3001` — ECU frames at 10 Hz
- `ws://localhost:3001/alerts` — alerts, run events, leaderboard nudges
