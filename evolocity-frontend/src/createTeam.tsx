import TeamSidebar from "./components/teamSidebar";
import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

interface Team {
	id: number;
	team_name: string;
	team_id: string;
	vehicle_class: string;
	vehicle_type: string;
	ecu_serial: number | null;
}

function CreateTeam() {
	const [teamName, setTeamName] = useState<string>("");
	const [teamId, setTeamId] = useState<string>("");
	const [vehicleClass, setVehicleClass] = useState<string>("Standard");
	const [vehicleType, setVehicleType] = useState<string>("Open");
	const [ecuSerial, setEcuSerial] = useState<string>("");
	const [ecuSerials, setEcuSerials] = useState<number[]>([]);
	const [nameErrorMsg, setNameErrorMsg] = useState<string>("");
	const [idErrorMsg, setIdErrorMsg] = useState<string>("");
	const [popupOpen, setPopupOpen] = useState<boolean>(false);
	const [ecuSwap, setEcuSwap] = useState<boolean>(false);
	const [pendingTeamData, setPendingTeamData] = useState<{
		name: string;
		team_id: string;
		vehicle_class: string;
		vehicle_type: string;
		ecu_serial: string;
	} | null>(null);
	const [conflictingTeams, setConflictingTeams] = useState<Team[]>([]);

	async function waitForPopupChoice(): Promise<"yes" | "cancel"> {
		return new Promise((resolve) => {
			const yesBtn = document.getElementById("yes");
			const cancelBtn = document.getElementById("cancel");

			// If buttons are not yet in the DOM, wait a tick and try again
			if (!yesBtn || !cancelBtn) {
				// small delay to allow React to render the popup
				setTimeout(() => {
					const yes = document.getElementById("yes");
					const cancel = document.getElementById("cancel");
					yes?.addEventListener("click", () => resolve("yes"), { once: true });
					cancel?.addEventListener("click", () => resolve("cancel"), { once: true });
				}, 0);
				return;
			}

			yesBtn.addEventListener("click", () => resolve("yes"), { once: true });
			cancelBtn.addEventListener("click", () => resolve("cancel"), { once: true });
		});
	}

	// Watch for popup close and continue if there's pending data
	useEffect(() => {
		if (!popupOpen && pendingTeamData) {
			// If ecuSwap is true, clear ECU from other teams first
			if (ecuSwap && conflictingTeams.length > 0) {
				conflictingTeams.forEach((team) => {
					fetch(`${API_BASE_URL}/teams/update/ecu`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id: team.id, ecu_serial: "" })
					});
				});
			}
			if (!ecuSwap) {
				return;
			}
			
			// Then create the team
			executeCreateTeam(pendingTeamData);
			console.log(pendingTeamData.ecu_serial);
			setPendingTeamData(null);
			setConflictingTeams([]);
		}
	}, [popupOpen, pendingTeamData, ecuSwap, conflictingTeams]);

	const executeCreateTeam = async (teamData: {
		name: string;
		team_id: string;
		vehicle_class: string;
		vehicle_type: string;
		ecu_serial: string;
	}) => {
		try {
			const response = await fetch(`${API_BASE_URL}/teams/create`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(teamData)
			});
			const data = await response.json();
			console.log('Success:', data);
		} catch (error) {
			console.error('Error:', error);
		}
	};

	async function createTeam() {
		setNameErrorMsg("");
		setIdErrorMsg("");
		let err = false;
		if (teamName === "") {
			setNameErrorMsg("Team name cannot be empty");
			console.log('Team name is empty');
			err = true;
		} else {
			const res = await fetch(`${API_BASE_URL}/teams/names/${teamName}`);
			const json = await res.json();
			const rows: Team[] = json.data ?? [];

			if (rows.length > 0) {
				setNameErrorMsg("Team name already in use");
				console.log('Team name must be unique');
				err = true;
			}
		}

		if (teamId === "") {
			setIdErrorMsg("Team ID cannot be empty");
			console.log('Team ID is empty');
			err = true;
		} else {
			const res = await fetch(`${API_BASE_URL}/teams/team_ids/${teamId}`);
			const json = await res.json();
			const idRows: Team[] = json.data ?? [];

			if (idRows.length > 0) {
				setIdErrorMsg("Team ID already in use");
				console.log('Team ID must be unique');
				err = true;
			}
		}

		if (err === true) {
			return;
		}
		const teamData = {
			name: teamName,
			team_id: teamId,
			vehicle_class: vehicleClass,
			vehicle_type: vehicleType,
			ecu_serial: ecuSerial
		};

		try {
			setEcuSwap(false);
			// If no ECU selected, just create the team
			if (teamData.ecu_serial === "" || teamData.ecu_serial == null) {
				await executeCreateTeam(teamData);
				return;
			}

			// Check for conflicting teams using this ECU
			const res = await fetch(`${API_BASE_URL}/teams/ecus/${teamData.ecu_serial}`);
			const json = await res.json();
			const rows: Team[] = json.data ?? [];

			if (rows.length === 0) {
				// No conflicts, create immediately
				await executeCreateTeam(teamData);
				return;
			}

			// Conflicts found: show popup and wait for user's choice
			setConflictingTeams(rows);
			setPopupOpen(true);

			const choice = await waitForPopupChoice();

			// Close popup for rendering
			setPopupOpen(false);

			if (choice === "cancel") {
				// User cancelled: do nothing
				setConflictingTeams([]);
				return;
			}

			// choice === "yes": remove ECU from conflicting teams first
			// Convert ecu_serial to the type your API expects; here we send empty string to clear
			await Promise.all(
				rows.map((team) =>
					fetch(`${API_BASE_URL}/teams/update/ecu`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ id: team.id, ecu_serial: "" })
					})
				)
			);

			// Now create the new team
			await executeCreateTeam(teamData);

			// cleanup
			setConflictingTeams([]);
		} catch (error) {
			console.error('Error:', error);
		}
	};

	useEffect(() => {
		fetch(`${API_BASE_URL}/ecu/serials`)
			.then((res) => res.json())
			.then((data) => {
				console.log("ECU serials response:", data);
				setEcuSerials(data.serials || []);
			})
			.catch((err) => console.error("Failed to fetch ECU serials:", err));
	}, []);

	function clearForm() {
		setTeamName("");
		setTeamId("");
	}

	return (
		<div className="createTeams" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
				<div className="modal-overlay" id="popup" style={{ visibility: popupOpen ? 'visible' : 'hidden' }}>
          <div className="modal-content">
            <h4>This ESP32 is being used by:</h4>
							{conflictingTeams.map((team) => (
								<p>
									{team.team_name}
								</p>
							))}
						<p>Would you still like to select it?</p>
						<p>Clicking "Yes" will remove the ESP32 from the other teams using it</p>
            <button id="yes" onClick={() => {setEcuSwap(true);setPopupOpen(false)}}>Yes</button>
						<button id="cancel" onClick={() => {setEcuSwap(false);setPopupOpen(false)}}>Cancel</button>
          </div>
        </div>
			<div className="teamForm" style={{ display: 'flex', flexDirection: 'column'}}>
				<div className="row1" style={{ display: 'flex', flexDirection: 'row'  }}>
					<div className="formInput" style={{ display: 'flex', flexDirection: 'column'}}>
						<h3>Team name</h3>
						<textarea id="name" value={teamName}
        		onChange={(e) => setTeamName(e.target.value)}>e.g. Team 4</textarea>
						<p>{nameErrorMsg}</p>
					</div>
					<div className="formInput" style={{ display: 'flex', flexDirection: 'column'}}>
						<h3>Team ID</h3>
						<textarea id="id" value={teamId}
        		onChange={(e) => setTeamId(e.target.value)}>e.g T04</textarea>
						<p>{idErrorMsg}</p>
					</div>
				</div>
				<div className="row2" style={{ display: 'flex', flexDirection: 'row' }}>
					<div className="formInput" style={{ display: 'flex', flexDirection: 'column'}}>
						<h3>Vehicle class</h3>
						<select value={vehicleClass}
        		onChange={(e) => setVehicleClass(e.target.value)}>
							<option value="standard">Standard</option>
							<option value="open">Open</option>
						</select>
					</div>
					<div className="formInput" style={{ display: 'flex', flexDirection: 'column'}}>
						<h3>Vehicle type</h3>
						<select value={vehicleType}
        		onChange={(e) => setVehicleType(e.target.value)}>
							<option value="kart">Kart</option>
							<option value="bike">Bike</option>
						</select>
					</div>
				</div>
				<div className="row3">
					<div className="formInput" style={{ display: 'flex', flexDirection: 'column'}}>
						<h3>ESP32 serial</h3>
						<select
							id="serials"
							value={ecuSerial}
							onChange={(e) => setEcuSerial(e.target.value)}
						>
							<option value="">None</option>
							{ecuSerials.map((serial) => (
								<option key={serial} value={serial}>
									{serial}
								</option>
							))}
						</select>
					</div>
				</div>
				<div className="row4" style={{ display: 'flex', flexDirection: 'row' }}>
					<button type="button" onClick={createTeam}>Create</button>
					<button type="button" onClick={clearForm}>Cancel</button>
				</div>
			</div>
			<TeamSidebar />
		</div>
	);
}

export default CreateTeam;