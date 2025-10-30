import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StackProvider } from "@stackframe/react";
import "./index.css";
import App from "./App.jsx";
import stackApp from "./stack-app.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StackProvider app={stackApp} lang="en">
      <App />
    </StackProvider>
  </StrictMode>
);
