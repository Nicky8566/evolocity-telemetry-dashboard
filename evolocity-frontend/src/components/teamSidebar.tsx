import { useEffect, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3001";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

interface Team {
  id: number;
  team_name: string;
	team_id: string;
	vehicle_class: string;
	vehicle_type: string;
	ecu_serial: string;
}

function TeamSidebar() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [loading, setLoading] = useState(true);
	const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/teams`)
      .then((res) => res.json())
      .then((data) => {
        setTeams(data.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch teams:", err);
        setLoading(false);
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

				if (msg.type !== "team") return;
				fetch(`${API_BASE_URL}/teams`)
				.then((res) => res.json())
				.then((data) => {
					setTeams(data.data || []);
					setLoading(false);
				})
				.catch((err) => {
					console.error("Failed to fetch teams:", err);
					setLoading(false);
				});
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

  }, []);

  return (
    <div className="sidebar" style={{ background: '#126476', padding:'10px', width:'250px' }}>
      <div className="topSection" style={{ display:'flex', flexDirection:'column'}}>
        <textarea id="searchbar">Search</textarea>
        <button type="button">Create team</button>
      </div>
      <div className="teams">
        <h3>Teams</h3>
        <div className="team-buttons" style={{ display: "block" }}>
          {loading ? (
            <p>Loading...</p>
          ) : teams.length === 0 ? (
            <p>No teams found</p>
          ) : (
            teams.map((team) => (
              <button
                key={team.id}
                className={
                  team.id.toString() === selectedTeam
                    ? "board-button active"
                    : "board-button"
                }
								style={{width:'80%'}}
                onClick={() => setSelectedTeam(team.id.toString())}
              >
                {team.team_name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamSidebar;

function setLatestFrame(frame: Team) {
	throw new Error("Function not implemented.");
}
