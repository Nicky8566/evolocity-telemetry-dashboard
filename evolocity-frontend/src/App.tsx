import { Route, Routes } from "react-router-dom"
import Layout from "./components/layout/Layout"
import Dashboard    from "./pages/Dashboard"
import Teams        from "./pages/Teams"
import Competitions from "./pages/Competitions"
import Leaderboard  from "./pages/Leaderboard"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index             element={<Dashboard />}    />
        <Route path="teams"        element={<Teams />}        />
        <Route path="competitions" element={<Competitions />} />
        <Route path="leaderboard"  element={<Leaderboard />}  />
      </Route>
    </Routes>
  )
}
