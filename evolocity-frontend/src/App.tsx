import { Route, Routes } from "react-router-dom"
import Layout from "./components/layout/Layout"
import Dashboard    from "./pages/Dashboard"
import Competitions from "./pages/Competitions"
import Leaderboard  from "./pages/Leaderboard"
import Alerts       from "./pages/Alerts"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index                element={<Dashboard />}    />
        <Route path="competitions"  element={<Competitions />} />
        <Route path="leaderboard"   element={<Leaderboard />}  />
        <Route path="alerts"        element={<Alerts />}       />
      </Route>
    </Routes>
  )
}
