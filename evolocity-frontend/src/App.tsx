import "./App.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useMemo, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3001";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

type Point = {
  time: string;
  voltage: number;
};

type BoardData = Record<string, Point[]>;

interface ECUFrame {
  ecu_serial: number;
  timestamp: string;
  voltage_samples: number[];
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

function App() {
  const [connected, setConnected] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState("");
  const [boardData, setBoardData] = useState<BoardData>({});
  const [latestFrame, setLatestFrame] = useState<ECUFrame | null>(null);

  const boardIds = Object.keys(boardData);

  const selectedData = useMemo(() => {
    return boardData[selectedBoard] ?? [];
  }, [boardData, selectedBoard]);

  const latestPoint = selectedData[selectedData.length - 1];

  useEffect(() => {
    fetch(`${API_BASE_URL}/ecu/history`)
      .then((res) => res.json())
      .then((json) => {
        const rows: HistoryRow[] = json.data ?? [];

        if (rows.length === 0) return;

        const grouped: BoardData = {};

        rows.forEach((row) => {
          const boardId = `ECU-${row.ecu_serial}`;

          if (!grouped[boardId]) {
            grouped[boardId] = [];
          }

          grouped[boardId].push({
            time: `${row.timestamp}ms`,
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
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "hello") {
          setConnected(true);
          return;
        }

        if (msg.type !== "ecu_frame") return;

        const frame: ECUFrame = msg.data;
        setLatestFrame(frame);

        const boardId = `ECU-${frame.ecu_serial}`;

        // Push all 10 samples at once
        const newPoints = frame.voltage_samples.map((v, i) => ({
          time: `${Number(frame.timestamp) + i * 10}ms`,
          voltage: v,
        }));

        console.log(`[${boardId}] Adding ${newPoints.length} points, queue size after: ${newPoints.length}`);

        setBoardData((prev) => {
          const existing = prev[boardId] ?? [];
          const updated = [...existing, ...newPoints].slice(-200);
          return { ...prev, [boardId]: updated };
        });

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

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="app">
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

      <section className="panel highlight">
        <h2>Live Voltage</h2>
        <p className="board-label">Viewing: {selectedBoard}</p>
        <div className="voltage-value">
          {latestPoint ? `${latestPoint.voltage.toFixed(2)} V` : "No data"}
        </div>
        <p className="timestamp">
          Last update: {latestPoint ? latestPoint.time : "--"}
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
              <XAxis dataKey="time" />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="voltage"
                stroke="#00A5C8"
                dot={false}
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

export default App;