import TeamSidebar from "./components/teamSidebar";
import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

function CreateTeam() {
	const [teamName, setTeamName] = useState<string>("");
	const [teamId, setTeamId] = useState<string>("");
	const [vehicleClass, setVehicleClass] = useState<string>("Standard");
	const [vehicleType, setVehicleType] = useState<string>("Open");
	const [ecuSerial, setEcuSerial] = useState<string>("");
	const [ecuSerials, setEcuSerials] = useState<number[]>([]);
	const [errorMsg, setErrorMsg] = useState<string>("");

	const createTeam = async () => {
		const requestOptions = {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: teamName,
				team_id: teamId,
				vehicle_class: vehicleClass,
				vehicle_type: vehicleType,
				ecu_serial: ecuSerial
			})
		};

		try {
			if (teamName == "" || teamId == "") {
				setErrorMsg("Team name, id, vehicle class and vehicle type cannot be empty")
				console.log('Some fields are empty')
				return;
			}
			const response = await fetch(`${API_BASE_URL}/teams/create`, requestOptions);
			const data = await response.json();
			console.log('Success:', data);
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

	return (
		<div className="createTeams" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
			<div className="teamForm" style={{ display: 'flex', flexDirection: 'column'}}>
				<div className="row1" style={{ display: 'flex', flexDirection: 'row'  }}>
					<div className="formInput" style={{ display: 'flex', flexDirection: 'column'}}>
						<h3>Team name</h3>
						<textarea value={teamName}
        		onChange={(e) => setTeamName(e.target.value)}>e.g. Team 4</textarea>
					</div>
					<div className="formInput" style={{ display: 'flex', flexDirection: 'column'}}>
						<h3>Team ID</h3>
						<textarea value={teamId}
        		onChange={(e) => setTeamId(e.target.value)}>e.g T04</textarea>
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
						<h3>ECU</h3>
						<select
							id="ecu_serial"
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
					<button type="button">Cancel</button>
				</div>
				<p>{errorMsg}</p>
			</div>
			<TeamSidebar />
		</div>
	);
}

export default CreateTeam;