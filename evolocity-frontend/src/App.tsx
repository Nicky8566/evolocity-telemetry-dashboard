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

const mockBoardData: BoardData = {
  "ESP32-01": [
    { time: "00.1", voltage: 12.1 },
    { time: "00.2", voltage: 12.2 },
    { time: "00.3", voltage: 12.0 },
    { time: "00.4", voltage: 12.4 },
    { time: "00.5", voltage: 12.3 },
    { time: "00.6", voltage: 12.5 },
  ],
  "ESP32-02": [
    { time: "00.1", voltage: 11.8 },
    { time: "00.2", voltage: 11.9 },
    { time: "00.3", voltage: 12.0 },
    { time: "00.4", voltage: 11.7 },
    { time: "00.5", voltage: 11.9 },
    { time: "00.6", voltage: 12.1 },
  ],
};

function App() {
  const [connected, setConnected] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState("ESP32-01");
  const [boardData, setBoardData] = useState<BoardData>({});
  const isEmpty = Object.keys(boardData).length === 0;
  const boardIds = isEmpty
    ? Object.keys(mockBoardData)
    : Object.keys(boardData);

  const selectedData = useMemo(() => {
    if (isEmpty) return mockBoardData[selectedBoard] ?? [];
    return boardData[selectedBoard] ?? [];
  }, [boardData, selectedBoard, isEmpty]);

  const latestPoint = selectedData[selectedData.length - 1];

  useEffect(() => {
    fetch(`${API_BASE_URL}/counter/history`)
      .then((res) => res.json())
      .then((data) => {
        const points = data.map((item: { value: number }, index: number) => ({
          time: index.toString(),
          voltage: item.value,
        }));

        if (points.length > 0) {
          setBoardData({
            "ESP32-01": points,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load history:", err);
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

        if (msg.type !== "telemetry") return;

        const { espSerial, averageVoltage, timestamp } = msg;

        setBoardData((prev) => {
          const existing = prev[espSerial] ?? [];

          const updated = [
            ...existing,
            {
              time: new Date(timestamp).toLocaleTimeString(),
              voltage: averageVoltage,
            },
          ].slice(-100);

          return {
            ...prev,
            [espSerial]: updated,
          };
        });

        setSelectedBoard((prev) => prev || espSerial);
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
