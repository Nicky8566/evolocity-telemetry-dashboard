import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { TelemetryProvider } from "./context/TelemetryContext"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TelemetryProvider>
        <App />
      </TelemetryProvider>
    </BrowserRouter>
  </StrictMode>,
)
