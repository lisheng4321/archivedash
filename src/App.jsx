import { useState, useEffect } from "react";
import { isSupabaseConfigured, supabase } from "./supabase.js";
import Dashboard from "./Dashboard.jsx";
import "./dashboard/shared/appStyles.js";

const cardSurface = { background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" };
const inp = { width: "100%", padding: "12px 14px", background: "#0d1117", border: "1px solid #232c3c", borderRadius: 8, color: "#e5e7eb", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 120ms ease, box-shadow 120ms ease" };
const primaryBtn = { padding: "12px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", width: "100%", transition: "filter 120ms ease, box-shadow 120ms ease", boxShadow: "0 12px 30px rgba(37,99,235,0.24)" };

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(""); setMessage("");
    if (!supabase) { setError("Supabase is not configured"); return; }
    if (!email || !password) { setError("Email and password required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b97ad", fontFamily: "'DM Sans', sans-serif" }}>
        Loading...
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 460, ...cardSurface, padding: 24, boxShadow: `${cardSurface.boxShadow}, 0 24px 70px rgba(0,0,0,0.35)` }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, color: "#f3f6fb" }}>Supabase setup needed</h1>
          <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.6, color: "#9ca3af" }}>
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy the app.
          </p>
          <div style={{ background: "#0d1117", border: "1px solid #232c3c", borderRadius: 8, padding: 12, color: "#93c5fd", fontSize: 12, lineHeight: 1.6, fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace" }}>
            VITE_SUPABASE_URL=https://your-project-id.supabase.co<br />
            VITE_SUPABASE_ANON_KEY=your-anon-key
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 380, padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 48, height: 48, background: "#2563eb", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 16, boxShadow: "0 18px 40px rgba(37,99,235,0.32), inset 0 1px 0 rgba(255,255,255,0.22)" }}>A</div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f3f6fb" }}>ArchiveDash</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#7c8aa0" }}>Reseller P&L Dashboard</p>
          </div>

          <div style={{ ...cardSurface, padding: 24, boxShadow: `${cardSurface.boxShadow}, 0 24px 70px rgba(0,0,0,0.35)` }}>
            <div style={{ display: "flex", gap: 3, marginBottom: 20, padding: 3, background: "#0d1117", border: "1px solid #232c3c", borderRadius: 9 }}>
              {["login", "signup"].map((m) => (
                <button key={m} onClick={() => { setAuthMode(m); setError(""); setMessage(""); }}
                  style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: authMode === m ? 700 : 500, color: authMode === m ? "#f3f6fb" : "#7c8aa0", background: authMode === m ? "#1f2937" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                  {m === "login" ? "Log in" : "Sign up"}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5 }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} placeholder="you@email.com" autoFocus />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5 }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inp} placeholder="••••••••" />
              </div>
              {error && <div style={{ background: "#1f1215", border: "1px solid #7f1d1d", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#f87171" }}>{error}</div>}
              {message && <div style={{ background: "#0d1f17", border: "1px solid #166534", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#4ade80" }}>{message}</div>}
              <button type="submit" style={primaryBtn}>{authMode === "login" ? "Log in" : "Create account"}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard onLogout={handleLogout} userEmail={session.user.email} />;
}
