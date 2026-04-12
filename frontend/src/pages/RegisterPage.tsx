import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, displayName);
      navigate("/", { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(", "));
      } else {
        setError(detail ?? "Registrierung fehlgeschlagen");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">HiTec-Zang</h1>
          <p className="text-gray-400 mt-1">Template Editor</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-white">Registrieren</h2>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">E-Mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white
                         focus:outline-none focus:border-blue-500 text-sm"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Anzeigename</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white
                         focus:outline-none focus:border-blue-500 text-sm"
              placeholder="Max Mustermann"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Passwort</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white
                         focus:outline-none focus:border-blue-500 text-sm"
              placeholder="Mindestens 8 Zeichen"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Passwort bestätigen</label>
            <input
              type="password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white
                         focus:outline-none focus:border-blue-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white
                       rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? "Wird registriert…" : "Account erstellen"}
          </button>

          <p className="text-center text-sm text-gray-400">
            Bereits registriert?{" "}
            <Link to="/login" className="text-blue-400 hover:underline">
              Anmelden
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
