import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { StackProvider, StackHandler } from "@stackframe/react";
import "./index.css";
import App from "./App.jsx";
import stackApp from "./stack-app.js";

export function Router() {
  const [location, setLocation] = useState(
    () => window.location.pathname + window.location.search
  );

  useEffect(() => {
    const handlePopState = () => {
      setLocation(window.location.pathname + window.location.search);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (location.startsWith("/handler")) {
    return <StackHandler app={stackApp} location={location} fullPage />;
  }

  return <App />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StackProvider app={stackApp} lang="en">
      <Router />
    </StackProvider>
  </StrictMode>
);
