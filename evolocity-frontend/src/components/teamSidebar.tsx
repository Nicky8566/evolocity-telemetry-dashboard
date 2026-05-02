import { useEffect, useState } from "react";
import { teamsApi } from "../api/teams";
import type { Team } from "../types";

function TeamSidebar() {
  const [teams, setTeams]             = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    teamsApi.list()
      .then(({ data }) => { setTeams(data); setLoading(false) })
      .catch((err) => { console.error("Failed to fetch teams:", err); setLoading(false) });
  }, []);

  return (
    <div className="sidebar" style={{ background: '#126476', padding:'10px', width:'250px', height: '75vh' }}>
      <div className="teams">
        <h3>Teams</h3>
        <div className="team-buttons" style={{ display: "block", height: '50vh', overflowY: 'auto' }}>
          {loading ? (
            <p>Loading...</p>
          ) : teams.length === 0 ? (
            <p>No teams found</p>
          ) : (
            teams.map((team) => (
              <button
                key={team.id}
                style={{ width: '80%' }}
                className={team.id.toString() === selectedTeam ? "board-button active" : "board-button"}
                onClick={() => setSelectedTeam(team.id.toString())}
              >
                {team.team_name} | {team.team_id} | {team.vehicle_class} | {team.vehicle_type} | {team.ecu_serial ?? "None"}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamSidebar;
