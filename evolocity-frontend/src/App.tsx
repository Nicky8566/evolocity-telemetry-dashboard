import { Route, Routes } from "react-router-dom"
import Layout               from "./components/layout/Layout"
import Competitions         from "./pages/Competitions"
import CompetitionDashboard from "./pages/CompetitionDashboard"
import Dashboard            from "./pages/Dashboard"
import Teams                from "./pages/Teams"
import Leaderboard          from "./pages/Leaderboard"
import Alerts               from "./pages/Alerts"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index                   element={<Competitions />}         />
        <Route path="competitions/:id" element={<CompetitionDashboard />} />
        <Route path="dashboard"        element={<Dashboard />}            />
        <Route path="teams"            element={<Teams />}                />
        <Route path="leaderboard"      element={<Leaderboard />}          />
        <Route path="alerts"           element={<Alerts />}               />
      </Route>
    </Routes>
  )
}
