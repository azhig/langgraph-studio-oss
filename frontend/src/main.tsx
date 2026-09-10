import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./styles/index.css";
import { installPlatform } from "./platform";

// The platform is configured before the app loads: stores read the storage at import time
installPlatform();
const { App } = await import("./App");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
