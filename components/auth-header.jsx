import { useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE;

export default function AuthHeader() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [user, setUser] = useState(null);

  return (
    <>
      <div className="mt-2 flex items-center justify-end gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-grey-600 to-indigo-600 text-white shadow-lg transform transition">
        {user ? (
          // Show user email and logout when logged in
          <>
            <span className="text-black font-medium">
              Welcome, {user?.username || user?.email || "player"}
            </span>
            <button
              className="flex items-center gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg hover:scale-105 transform transition"
              onClick={() => setUser(null)}
            >
              Logout
            </button>
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

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLoginSuccess={(userData) => {
            setUser(userData);
            setShowLogin(false);
          }}
        />
      )}
      {showSignUp && (
        <SignUpModal
          onClose={() => setShowSignUp(false)}
          onLoginSuccess={setUser}
        />
      )}
    </>
  );
}

function LoginModal({ onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_BASE + "/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const userData = await response.json();
        console.log("Login successful:", userData);
        onLoginSuccess(userData.user);
      } else {
        setError("Login failed. Please check your credentials.");
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

function SignUpModal({ onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_BASE + "/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("SignUp successful:", data);
        onLoginSuccess(data.user);

        onClose(); // Close modal on success
      } else {
        setError("Sign up failed. Please try again.");
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
