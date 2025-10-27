import { useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE;

export default function AuthHeader() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [user, setUser] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const requireVerification = (email, message) => {
    setVerificationEmail(email);
    setShowVerification(true);
    setStatusMessage(message || "Check your inbox to verify your account.");
  };

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
              onClick={() => {
                setUser(null);
                setStatusMessage("");
                setShowVerification(false);
              }}
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

      {statusMessage && (
        <div className="mt-2 text-sm text-white/80 text-right px-6">
          {statusMessage}
        </div>
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLoginSuccess={(userData) => {
            setUser(userData);
            setStatusMessage("");
            setShowLogin(false);
            setShowVerification(false);
          }}
          onRequireVerification={(email, message) => {
            setShowLogin(false);
            requireVerification(
              email,
              message || "Please verify your email before logging in."
            );
          }}
        />
      )}
      {showSignUp && (
        <SignUpModal
          onClose={() => setShowSignUp(false)}
          onRequireVerification={(email, message) => {
            setShowSignUp(false);
            requireVerification(
              email,
              message || "Account created! Check your inbox to verify."
            );
          }}
        />
      )}
      {showVerification && (
        <VerificationModal
          email={verificationEmail}
          onClose={() => setShowVerification(false)}
          onVerified={(verifiedUser) => {
            setUser(verifiedUser);
            setStatusMessage("");
            setShowVerification(false);
          }}
          onResent={() =>
            setStatusMessage("Verification email resent. Check your inbox.")
          }
        />
      )}
    </>
  );
}

function LoginModal({ onClose, onLoginSuccess, onRequireVerification }) {
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
        return;
      }

      const errorBody = await response.json().catch(() => ({}));

      if (response.status === 403 && errorBody?.code === "EMAIL_NOT_VERIFIED") {
        onRequireVerification?.(
          email,
          errorBody?.message || "Please verify your email before logging in."
        );
        setError(
          errorBody?.message || "Please verify your email before logging in."
        );
        return;
      }

      setError(
        errorBody?.message || "Login failed. Please check your credentials."
      );
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

function SignUpModal({ onClose, onRequireVerification }) {
  const [username, setUsername] = useState("");
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
        body: JSON.stringify({
          email,
          password,
          username: username.trim() || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("SignUp successful:", data);
        onRequireVerification?.(
          email,
          data?.message || "Account created. Check your inbox to verify."
        );
        setUsername("");
        setEmail("");
        setPassword("");
        onClose();
      } else {
        const errorBody = await response.json().catch(() => ({}));
        setError(errorBody?.message || "Sign up failed. Please try again.");
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
            type="text"
            placeholder="Username (optional)"
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
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

function VerificationModal({ email, onClose, onVerified, onResent }) {
  const [token, setToken] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleResend = async () => {
    setResendLoading(true);
    setFeedback("");

    try {
      const response = await fetch(API_BASE + "/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        setFeedback(body?.message || "Verification email resent.");
        onResent?.();
      } else {
        setFeedback(body?.message || "Unable to resend verification email.");
      }
    } catch (error) {
      console.error("Resend verification failed:", error);
      setFeedback("Unable to resend verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyLoading(true);
    setFeedback("");

    try {
      const response = await fetch(API_BASE + "/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        onVerified?.(body?.user);
        setFeedback(body?.message || "Email verified!");
        setToken("");
        return;
      }

      setFeedback(
        body?.message || "Verification failed. Check the token and try again."
      );
    } catch (error) {
      console.error("Email verification failed:", error);
      setFeedback("Verification failed. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg relative">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
          Verify your email
        </h2>
        <p className="text-sm text-gray-600 text-center mb-6">
          We sent a verification link to{" "}
          <span className="font-semibold">{email}</span>. Check your inbox (and
          spam folder) to activate your account. You can also paste the
          verification token below.
        </p>

        <form className="space-y-4" onSubmit={handleVerify}>
          <input
            type="text"
            placeholder="Paste verification token"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
            disabled={verifyLoading || token.trim().length === 0}
          >
            {verifyLoading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="w-full py-3 rounded-lg border border-indigo-500 text-indigo-600 font-semibold hover:bg-indigo-50 transition disabled:opacity-50"
            onClick={handleResend}
            disabled={resendLoading}
          >
            {resendLoading ? "Resending..." : "Resend verification email"}
          </button>
          <button
            type="button"
            className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition"
            onClick={onClose}
          >
            I will verify later
          </button>
        </div>

        {feedback && (
          <div className="mt-4 text-sm text-center text-gray-700">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}
