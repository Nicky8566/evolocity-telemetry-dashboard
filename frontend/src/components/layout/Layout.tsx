import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Navbar from "./Navbar"

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="flex flex-col min-h-screen bg-ev-bg text-white">
      <Navbar />
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
