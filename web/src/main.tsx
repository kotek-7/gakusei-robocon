import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./study/App";
import "./style.css";
createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
