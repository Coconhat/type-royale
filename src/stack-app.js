import { StackClientApp } from "@stackframe/react";

const projectId = import.meta.env.VITE_STACK_PROJECT_ID;
const publishableClientKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY;
const baseUrl = import.meta.env.VITE_STACK_BASE_URL;

const stackApp = new StackClientApp({
  tokenStore: "cookie",
  ...(projectId ? { projectId } : {}),
  ...(publishableClientKey ? { publishableClientKey } : {}),
  ...(baseUrl ? { baseUrl } : {}),
  urls: {
    afterSignIn: window.location.origin,
    afterSignUp: window.location.origin,
  },
});

export default stackApp;
