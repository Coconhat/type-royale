import { useState } from "react";
import { useStackApp, useUser } from "@stackframe/react";

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    return error.message || fallback;
  }
  return fallback;
}

export default function AuthHeader() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const stackUser = useUser();

  return (
    <>
      <div className="mt-2 flex items-center justify-end gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-grey-600 to-indigo-600 text-white shadow-lg transform transition">
        {stackUser ? (
          // Show user email and logout when logged in
          <>
            <span className="text-black font-medium">
              Welcome,{" "}
              {stackUser.displayName || stackUser.primaryEmail || "player"}
            </span>
            <LogoutButton />
          </>
        ) : (
          // Show login/signup buttons when not logged in
          <>
            <button
              className="flex items-center gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-105 transform transition"
              onClick={() => {
                setShowLogin(true);
                setShowSignUp(false);
              }}
            >
              Login
            </button>

            <button
              className="flex items-center gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-105 transform transition"
              onClick={() => {
                setShowSignUp(true);
                setShowLogin(false);
              }}
            >
              Sign Up
            </button>
          </>
        )}
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showSignUp && <SignUpModal onClose={() => setShowSignUp(false)} />}
    </>
  );
}

function LoginModal({ onClose }) {
  const stackApp = useStackApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const oauthProviders = [
    { id: "github", label: "GitHub" },
    { id: "google", label: "Google" },
  ];

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleOAuth = async (providerId) => {
    try {
      await stackApp.signInWithOAuth(providerId);
    } catch (oauthErr) {
      console.error(`OAuth sign-in with ${providerId} failed`, oauthErr);
      setError(
        getErrorMessage(
          oauthErr,
          "OAuth sign-in failed. Please try again or use email/password."
        )
      );
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await stackApp.signInWithCredential({
        email,
        password,
        noRedirect: true,
      });

      if (result.status === "ok") {
        onClose();
      }
      if (result.status === "error") {
        setError(
          getErrorMessage(
            result.error,
            "Login failed. Please check your credentials."
          )
        );
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Login
        </h2>
        <form className="flex flex-col gap-4" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-gray-200" aria-hidden />
            <span className="text-sm text-gray-500">or continue with</span>
            <span className="flex-1 h-px bg-gray-200" aria-hidden />
          </div>
          <div className="mt-4 grid gap-3">
            {oauthProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleOAuth(provider.id)}
                className="flex items-center justify-center gap-2 w-full py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600 text-center">
          Don’t have an account?{" "}
          <span
            className="text-indigo-600 font-semibold cursor-pointer hover:underline"
            onClick={onClose}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}

function LogoutButton() {
  const stackApp = useStackApp();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await stackApp.signOut({ noRedirect: true });
    } catch (signOutError) {
      console.error("Logout failed", signOutError);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <button
      className="flex items-center gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg hover:scale-105 transform transition disabled:opacity-50"
      onClick={handleLogout}
      disabled={signingOut}
    >
      {signingOut ? "Logging out…" : "Logout"}
    </button>
  );
}

function SignUpModal({ onClose }) {
  const stackApp = useStackApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const oauthProviders = [
    { id: "github", label: "GitHub" },
    { id: "google", label: "Google" },
  ];

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleOAuth = async (providerId) => {
    try {
      await stackApp.signInWithOAuth(providerId);
    } catch (oauthErr) {
      console.error(`OAuth sign-up with ${providerId} failed`, oauthErr);
      setError(
        getErrorMessage(
          oauthErr,
          "OAuth sign-up failed. Please try again or use email/password."
        )
      );
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await stackApp.signUpWithCredential({
        email,
        password,
        noRedirect: true,
        noVerificationCallback: true,
      });

      if (result.status === "ok") {
        // Ensure the newly created account is signed in before closing the modal.
        const loginResult = await stackApp.signInWithCredential({
          email,
          password,
          noRedirect: true,
        });

        if (loginResult.status === "error") {
          setError(
            getErrorMessage(
              loginResult.error,
              "Account created but automatic sign-in failed. Please sign in manually."
            )
          );
          return;
        }

        onClose();
      }

      if (result.status === "error") {
        setError(
          getErrorMessage(result.error, "Sign up failed. Please try again.")
        );
      }
    } catch (error) {
      console.error("SignUp failed:", error);
      setError("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Create Account
        </h2>
        <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
          <input
            type="email"
            placeholder="Email"
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-gray-200" aria-hidden />
            <span className="text-sm text-gray-500">or continue with</span>
            <span className="flex-1 h-px bg-gray-200" aria-hidden />
          </div>
          <div className="mt-4 grid gap-3">
            {oauthProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleOAuth(provider.id)}
                className="flex items-center justify-center gap-2 w-full py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600 text-center">
          Already have an account?{" "}
          <span
            className="text-indigo-600 font-semibold cursor-pointer hover:underline"
            onClick={onClose}
          >
            Log in
          </span>
        </p>
      </div>
    </div>
  );
}
