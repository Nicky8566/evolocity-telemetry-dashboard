import "./App.css";
import "react-toastify/dist/ReactToastify.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer, toast } from "react-toastify";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3001";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

type Point = {
  timeMs: number;
  voltage: number;
};

type BoardData = Record<string, Point[]>;
type LatestFrames = Record<string, ECUFrame>;

type VoltageLimitState = {
  isOverLimit: boolean;
  violationTimerId: number | null;
  violationShown: boolean;
};

type VoltageLimitStates = Record<string, VoltageLimitState>;

interface ECUFrame {
  ecu_serial: number;
  timestamp: string;
  voltage_samples: number[];
  current_samples: number[];
  avg_voltage: number;
  avg_current: number | null;
  penalty: boolean;
}

interface HistoryRow {
  id: number;
  ecu_serial: number;
  timestamp: string;
  avg_voltage: number;
  penalty: number;
  recorded_at: string;
}

const DEFAULT_VOLTAGE_LIMIT = 48;
const VIOLATION_DELAY_MS = 1000;

const getBoardId = (ecuSerial: number) => `ECU-${ecuSerial}`;
const getDeviceName = (ecuSerial: number) => `ESP-${ecuSerial}`;

const createVoltageLimitState = (): VoltageLimitState => ({
  isOverLimit: false,
  violationTimerId: null,
  violationShown: false,
});

function App() {
  const [connected, setConnected] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState("");
  const [boardData, setBoardData] = useState<BoardData>({});
  const [latestFrame, setLatestFrame] = useState<ECUFrame | null>(null);
  const [voltageLimit, setVoltageLimit] = useState(DEFAULT_VOLTAGE_LIMIT);
  const zeroTimeoutsRef = useRef<Record<string, number>>({});
  const latestFramesRef = useRef<LatestFrames>({});
  const voltageLimitRef = useRef(voltageLimit);
  const voltageLimitStatesRef = useRef<VoltageLimitStates>({});

  const boardIds = Object.keys(boardData);

  const selectedData = useMemo(() => {
    return boardData[selectedBoard] ?? [];
  }, [boardData, selectedBoard]);

  const latestPoint = selectedData[selectedData.length - 1];

  const notifyVoltageWarning = useCallback((
    deviceName: string,
    voltage: number,
    limit: number,
  ) => {
    toast.warn(
      `${deviceName} voltage warning: ${voltage.toFixed(2)} V exceeded ${limit.toFixed(2)} V.`,
      {
        toastId: `voltage-warning-${deviceName}-${Date.now()}`,
      },
    );
  }, []);

  const notifyVoltageViolation = useCallback((
    deviceName: string,
    voltage: number,
    limit: number,
  ) => {
    toast.error(
      `${deviceName} voltage violation: ${voltage.toFixed(2)} V stayed above ${limit.toFixed(2)} V for more than 1 second.`,
      {
        toastId: `voltage-violation-${deviceName}-${Date.now()}`,
      },
    );
  }, []);

  const clearViolationTimer = useCallback((limitState: VoltageLimitState) => {
    if (limitState.violationTimerId !== null) {
      window.clearTimeout(limitState.violationTimerId);
    }
  }, []);

  const resetVoltageLimitState = useCallback((boardId: string) => {
    const limitState = voltageLimitStatesRef.current[boardId];

    if (!limitState) return;

    clearViolationTimer(limitState);
    voltageLimitStatesRef.current[boardId] = createVoltageLimitState();
  }, [clearViolationTimer]);

  const monitorVoltageLimit = useCallback((frame: ECUFrame) => {
    const boardId = getBoardId(frame.ecu_serial);
    const deviceName = getDeviceName(frame.ecu_serial);
    const limit = voltageLimitRef.current;
    const voltage = frame.avg_voltage;
    const isOverLimit = voltage > limit;
    const limitState =
      voltageLimitStatesRef.current[boardId] ?? createVoltageLimitState();

    voltageLimitStatesRef.current[boardId] = limitState;

    if (!isOverLimit) {
      if (limitState.isOverLimit) {
        resetVoltageLimitState(boardId);
      }
      return;
    }

    if (limitState.isOverLimit) return;

    notifyVoltageWarning(deviceName, voltage, limit);

    const violationTimerId = window.setTimeout(() => {
      const currentState = voltageLimitStatesRef.current[boardId];
      const latestFrameForBoard = latestFramesRef.current[boardId];
      const latestLimit = voltageLimitRef.current;

      if (
        !currentState?.isOverLimit ||
        currentState.violationShown ||
        !latestFrameForBoard ||
        latestFrameForBoard.avg_voltage <= latestLimit
      ) {
        return;
      }

      voltageLimitStatesRef.current[boardId] = {
        ...currentState,
        violationShown: true,
        violationTimerId: null,
      };

      notifyVoltageViolation(
        deviceName,
        latestFrameForBoard.avg_voltage,
        latestLimit,
      );
    }, VIOLATION_DELAY_MS);

    voltageLimitStatesRef.current[boardId] = {
      isOverLimit: true,
      violationShown: false,
      violationTimerId,
    };
  }, [notifyVoltageViolation, notifyVoltageWarning, resetVoltageLimitState]);

  useEffect(() => {
    voltageLimitRef.current = voltageLimit;

    Object.entries(latestFramesRef.current).forEach(([boardId, frame]) => {
      if (frame.avg_voltage <= voltageLimit) {
        resetVoltageLimitState(boardId);
        return;
      }

      monitorVoltageLimit(frame);
    });
  }, [monitorVoltageLimit, resetVoltageLimitState, voltageLimit]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/ecu/history`)
      .then((res) => res.json())
      .then((json) => {
        const rows: HistoryRow[] = json.data ?? [];

        if (rows.length === 0) return;

        const grouped: BoardData = {};

        rows.forEach((row) => {
          const boardId = getBoardId(row.ecu_serial);

          if (!grouped[boardId]) {
            grouped[boardId] = [];
          }

          const nextTimeMs = grouped[boardId].length * 100;

          grouped[boardId].push({
            timeMs: nextTimeMs,
            voltage: row.avg_voltage,
          });
        });

        setBoardData(grouped);

        const firstBoard = Object.keys(grouped)[0];
        if (firstBoard) {
          setSelectedBoard(firstBoard);
        }
      })
      .catch((err) => {
        console.error("Failed to load ECU history:", err);
      });

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
      console.log("Connected to backend");
      console.log("Using WebSocket URL:", WS_URL);
    };

    ws.onmessage = (event) => {
      // 🔍 1. Raw payload from backend
      console.log("RAW WS MESSAGE:", event.data);

      try {
        const msg = JSON.parse(event.data);

        // 🔍 2. Parsed message
        console.log("PARSED MESSAGE:", msg);

        if (msg.type === "hello") {
          console.log("Received HELLO message");
          setConnected(true);
          return;
        }

        if (msg.type !== "ecu_frame") return;

        const frame: ECUFrame = msg.data;

        // 🔍 3. Inspect ECU frame deeply
        console.log("ECU FRAME:", frame);
        console.log("Voltage samples:", frame.voltage_samples);
        console.log("Current samples:", frame.current_samples);
        console.log("Avg voltage:", frame.avg_voltage);
        console.log("Avg current:", frame.avg_current);
        console.log("Penalty:", frame.penalty);

        setLatestFrame(frame);

        const boardId = getBoardId(frame.ecu_serial);
        latestFramesRef.current[boardId] = frame;
        monitorVoltageLimit(frame);

        if (zeroTimeoutsRef.current[boardId]) {
          window.clearTimeout(zeroTimeoutsRef.current[boardId]);
        }

        setBoardData((prev) => {
          const existing = prev[boardId] ?? [];
          const lastTimeMs =
            existing.length > 0 ? existing[existing.length - 1].timeMs : 0;

          const newPoint: Point = {
            timeMs: lastTimeMs + 100,
            voltage: frame.avg_voltage,
          };

          // 🔍 4. See what gets added to chart
          console.log("Adding point to chart:", {
            boardId,
            timeMs: newPoint.timeMs,
            voltage: newPoint.voltage,
          });

          const updated = [...existing, newPoint].slice(-200);

          return {
            ...prev,
            [boardId]: updated,
          };
        });

        zeroTimeoutsRef.current[boardId] = window.setTimeout(() => {
          setBoardData((prev) => {
            const existing = prev[boardId] ?? [];

            if (existing.length === 0) return prev;

            const lastPoint = existing[existing.length - 1];

            if (lastPoint.voltage === 0) return prev;

            const zeroPoint: Point = {
              timeMs: lastPoint.timeMs + 100,
              voltage: 0,
            };

            console.log("Injecting zero point due to timeout:", zeroPoint);

            const updated = [...existing, zeroPoint].slice(-200);

            return {
              ...prev,
              [boardId]: updated,
            };
          });
        }, 3000);

        setSelectedBoard((prev) => prev || boardId);
      } catch (err) {
        console.error("Invalid WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("WebSocket disconnected");
    };

    ws.onerror = () => {
      setConnected(false);
    };

    const zeroTimeouts = zeroTimeoutsRef.current;
    const voltageLimitStates = voltageLimitStatesRef.current;

    return () => {
      ws.close();

      Object.values(zeroTimeouts).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });

      Object.values(voltageLimitStates).forEach((limitState) => {
        clearViolationTimer(limitState);
      });
    };
  }, [clearViolationTimer, monitorVoltageLimit]);

  return (
    <div className="app">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        pauseOnHover
        theme="colored"
      />
      <header className="header">
        <h1>EVolocity Telemetry Viewer</h1>
        <p className="status">
          Status: {connected ? "Connected" : "Disconnected"}
        </p>
        <p className="timestamp">
          Boards detected: {boardIds.length > 0 ? boardIds.join(", ") : "None"}
        </p>
      </header>

      <section className="panel">
        <h2>Select Board</h2>
        <div className="board-buttons">
          {boardIds.map((boardId) => (
            <button
              key={boardId}
              className={
                boardId === selectedBoard
                  ? "board-button active"
                  : "board-button"
              }
              onClick={() => setSelectedBoard(boardId)}
            >
              {boardId}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="limit-header">
          <div>
            <h2>Voltage Limit</h2>
            <p className="timestamp">
              Warning above {voltageLimit.toFixed(2)} V, violation after 1 s.
            </p>
          </div>
          <output className="limit-output" htmlFor="voltage-limit">
            {voltageLimit.toFixed(2)} V
          </output>
        </div>
        <div className="limit-control">
          <input
            id="voltage-limit"
            type="range"
            min="0"
            max="60"
            step="0.1"
            value={voltageLimit}
            onChange={(event) => setVoltageLimit(Number(event.target.value))}
            aria-label="Voltage limit"
          />
          <input
            className="limit-number"
            type="number"
            min="0"
            max="60"
            step="0.1"
            value={voltageLimit}
            onChange={(event) => {
              const nextLimit = Number(event.target.value);

              if (Number.isFinite(nextLimit)) {
                setVoltageLimit(nextLimit);
              }
            }}
            aria-label="Voltage limit in volts"
          />
        </div>
      </section>

      <section className="panel highlight">
        <h2>Live Voltage</h2>
        <p className="board-label">Viewing: {selectedBoard}</p>
        <div className="voltage-value">
          {latestPoint ? `${latestPoint.voltage.toFixed(2)} V` : "No data"}
        </div>
        <p className="timestamp">
          Last update:{" "}
          {latestPoint ? `${(latestPoint.timeMs / 1000).toFixed(2)} s` : "--"}
        </p>
        {latestFrame && (
          <p className="timestamp">
            Latest ECU frame serial: {latestFrame.ecu_serial}
          </p>
        )}
      </section>

      <section className="panel chart-panel">
        <h2>Voltage Graph</h2>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={selectedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timeMs"
                tickFormatter={(value) => `${(value / 1000).toFixed(1)}s`}
                minTickGap={30}
              />
              <YAxis domain={[0, 60]} width={60} />
              <Tooltip
                formatter={(value) => {
                  const num =
                    typeof value === "number" ? value : Number(value ?? 0);
                  return [`${num.toFixed(2)} V`, "Voltage"];
                }}
                labelFormatter={(label) => {
                  const num =
                    typeof label === "number" ? label : Number(label ?? 0);
                  return `Time: ${(num / 1000).toFixed(2)} s`;
                }}
              />
              <Line
                type="linear"
                dataKey="voltage"
                stroke="#00A5C8"
                dot={false}
                strokeWidth={3}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

export default App;
