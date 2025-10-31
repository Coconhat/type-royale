import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { StackProvider, StackHandler } from "@stackframe/react";
import "./index.css";
import App from "./App.jsx";
import TimeAttack from "../components/time-attack";
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") || !params.has("state")) {
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const redirected = await stackApp.callOAuthCallback();
        if (redirected) {
          return;
        }
      } catch (error) {
        console.error("OAuth callback handling failed", error);
      } finally {
        if (isMounted) {
          const url = window.location.pathname;
          window.history.replaceState({}, "", url);
          setLocation(url);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (location.startsWith("/handler")) {
    return <StackHandler app={stackApp} location={location} fullPage />;
  }

  const [pathname] = location.split("?");
  if (pathname === "/test") {
    return <TimeAttack />;
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
