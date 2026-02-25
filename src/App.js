import { useState, useRef, useCallback, useEffect } from "react";

const DB = {
  getUsers: () => JSON.parse(localStorage.getItem("saathi_users") || "{}"),
  saveUsers: (u) => localStorage.setItem("saathi_users", JSON.stringify(u)),
  getChats: (uid) =>
    JSON.parse(localStorage.getItem(`saathi_chats_${uid}`) || "[]"),
  saveChats: (uid, c) =>
    localStorage.setItem(`saathi_chats_${uid}`, JSON.stringify(c)),
  getMoods: (uid) =>
    JSON.parse(localStorage.getItem(`saathi_moods_${uid}`) || "[]"),
  saveMoods: (uid, m) =>
    localStorage.setItem(`saathi_moods_${uid}`, JSON.stringify(m)),
  getSub: (uid) =>
    JSON.parse(
      localStorage.getItem(`saathi_sub_${uid}`) ||
        '{"status":"free","expiry_date":null}'
    ),
  saveSub: (uid, s) =>
    localStorage.setItem(`saathi_sub_${uid}`, JSON.stringify(s)),
  getSession: () => localStorage.getItem("saathi_session"),
  saveSession: (uid) => localStorage.setItem("saathi_session", uid),
  clearSession: () => localStorage.removeItem("saathi_session"),
  getApiKey: () => localStorage.getItem("saathi_groq_key") || "",
  saveApiKey: (k) => localStorage.setItem("saathi_groq_key", k),
};

const CRISIS_KEYWORDS = [
  "hurt myself",
  "suicide",
  "kill myself",
  "self harm",
  "end my life",
  "want to die",
  "cut myself",
  "overdose",
];
const SYSTEM_PROMPT =
  "You are Saathi AI, a calm, warm emotional companion. You listen without judgment, respond gently, and encourage healthy real-world support when necessary. You are not a therapist.";
const MOODS = [
  { emoji: "🙂", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😔", label: "Sad" },
  { emoji: "😡", label: "Angry" },
  { emoji: "😢", label: "Crying" },
];
const hasCrisis = (t) =>
  CRISIS_KEYWORDS.some((k) => t.toLowerCase().includes(k));
const todayCount = (chats) => {
  const d = new Date().toDateString();
  return chats.filter(
    (c) => c.role === "user" && new Date(c.created_at).toDateString() === d
  ).length;
};
const fmt = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

async function callGroq(apiKey, chats, userMessage) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...chats.slice(-10).map((c) => ({ role: c.role, content: c.message })),
    { role: "user", content: userMessage },
  ];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 400,
      temperature: 0.8,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{--beige:#faf6f1;--beige2:#f3ede4;--peach:#f2c4a8;--peach2:#e8a882;--blue:#b8d4e8;--sage:#c8d8c0;--text:#3d2e22;--text2:#7a6555;--text3:#a8978a;--white:#fffdfb;--shadow:0 4px 24px rgba(61,46,34,0.08);}
  html,body,#root{height:100%;margin:0;padding:0;}
  body{font-family:'DM Sans',sans-serif;background:var(--beige);color:var(--text);}
  .wrap{height:100vh;display:flex;flex-direction:column;max-width:700px;margin:0 auto;padding:0.6rem;gap:0.5rem;}
  .hdr{display:flex;align-items:center;justify-content:space-between;padding:0.6rem 1rem;background:var(--white);border-radius:18px;box-shadow:var(--shadow);flex-shrink:0;}
  .hdr-l{display:flex;align-items:center;gap:0.5rem;font-family:'Lora',serif;font-size:1.1rem;}
  .hdr-r{display:flex;align-items:center;gap:0.6rem;}
  .badge{font-size:0.68rem;padding:2px 8px;border-radius:20px;font-weight:500;}
  .badge.free{background:var(--beige2);color:var(--text2);}
  .badge.premium{background:linear-gradient(135deg,#f2c45a,#e8a828);color:#fff;}
  .cnt{font-size:0.75rem;color:var(--text3);}
  .btn-sm{padding:0.3rem 0.75rem;background:var(--beige2);border:none;border-radius:8px;font-size:0.8rem;color:var(--text2);cursor:pointer;}
  .groq-badge{font-size:0.7rem;background:#ede9fe;color:#6366f1;padding:2px 8px;border-radius:20px;font-weight:500;}
  .mood{background:var(--white);border-radius:18px;padding:0.75rem 1.25rem;box-shadow:var(--shadow);flex-shrink:0;}
  .mood h3{font-family:'Lora',serif;font-size:0.88rem;color:var(--text2);margin-bottom:0.5rem;font-style:italic;font-weight:400;}
  .mood-row{display:flex;gap:0.4rem;}
  .mbtn{font-size:1.35rem;background:var(--beige2);border:2px solid transparent;border-radius:10px;padding:0.3rem 0.55rem;cursor:pointer;transition:all 0.15s;line-height:1;}
  .mbtn:hover{transform:scale(1.15);}
  .mbtn.sel{border-color:var(--peach2);background:#fdf0e8;}
  .chat-box{flex:1;background:var(--white);border-radius:18px;box-shadow:var(--shadow);display:flex;flex-direction:column;overflow:hidden;min-height:0;}
  .msgs{flex:1;overflow-y:auto;padding:1.2rem;display:flex;flex-direction:column;gap:0.75rem;}
  .msgs::-webkit-scrollbar{width:3px;}
  .msgs::-webkit-scrollbar-thumb{background:var(--beige2);border-radius:3px;}
  .bw{display:flex;align-items:flex-end;gap:0.4rem;}
  .bw.u{flex-direction:row-reverse;}
  .av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;flex-shrink:0;}
  .av.ai{background:linear-gradient(135deg,var(--blue),var(--sage));}
  .av.u{background:linear-gradient(135deg,var(--peach),var(--peach2));}
  .bbl{max-width:74%;padding:0.6rem 0.9rem;border-radius:16px;font-size:0.88rem;line-height:1.55;}
  .bbl.ai{background:var(--beige);border-bottom-left-radius:3px;}
  .bbl.u{background:linear-gradient(135deg,var(--peach),#f0b898);border-bottom-right-radius:3px;}
  .bbl.cr{background:#fde8e0;border:1px solid #f4a080;}
  .bbl time{display:block;font-size:0.68rem;color:var(--text3);margin-top:0.25rem;}
  .typing{display:flex;gap:3px;align-items:center;padding:0.2rem 0;}
  .typing span{width:5px;height:5px;border-radius:50%;background:var(--text3);animation:bounce 1.2s infinite;}
  .typing span:nth-child(2){animation-delay:0.2s;}
  .typing span:nth-child(3){animation-delay:0.4s;}
  .empty{text-align:center;margin:auto;color:var(--text3);}
  .empty .ic{font-size:2.2rem;display:block;margin-bottom:0.6rem;}
  .empty p{font-family:'Lora',serif;font-style:italic;font-size:0.9rem;}
  .ibar{padding:0.75rem 1rem;border-top:1px solid var(--beige2);display:flex;gap:0.5rem;align-items:flex-end;flex-shrink:0;}
  .ibar textarea{flex:1;padding:0.6rem 0.85rem;border:1.5px solid var(--beige2);border-radius:12px;font-family:'DM Sans',sans-serif;font-size:0.88rem;color:var(--text);background:var(--beige);outline:none;resize:none;max-height:90px;line-height:1.5;transition:border-color 0.2s;}
  .ibar textarea:focus{border-color:var(--peach2);background:var(--white);}
  .btn-send{padding:0.6rem 1rem;background:linear-gradient(135deg,var(--peach2),#d4906a);color:#fff;border:none;border-radius:11px;cursor:pointer;font-size:0.95rem;flex-shrink:0;}
  .btn-send:disabled{opacity:0.45;cursor:not-allowed;}
  .btn-up{padding:0.5rem 0.85rem;background:linear-gradient(135deg,#f2c45a,#e8a828);color:#fff;border:none;border-radius:11px;cursor:pointer;font-size:0.78rem;font-weight:500;flex-shrink:0;white-space:nowrap;}
  .auth-wrap{height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;}
  .auth-card{background:var(--white);border-radius:24px;padding:2.2rem;max-width:400px;width:100%;box-shadow:var(--shadow);}
  .auth-logo{text-align:center;margin-bottom:1.75rem;}
  .auth-logo span{font-size:2.2rem;display:block;margin-bottom:0.4rem;}
  .auth-logo h1{font-family:'Lora',serif;font-size:1.7rem;}
  .auth-logo p{color:var(--text3);font-size:0.82rem;margin-top:0.2rem;}
  .tabs{display:flex;gap:0.4rem;margin-bottom:1.25rem;background:var(--beige2);border-radius:10px;padding:3px;}
  .tab{flex:1;padding:0.45rem;border:none;background:transparent;border-radius:8px;font-size:0.88rem;color:var(--text2);cursor:pointer;font-family:'DM Sans',sans-serif;}
  .tab.active{background:var(--white);color:var(--text);font-weight:500;}
  .field{margin-bottom:0.85rem;}
  .field label{display:block;font-size:0.75rem;font-weight:500;color:var(--text2);margin-bottom:0.35rem;text-transform:uppercase;}
  .field input{width:100%;padding:0.65rem 0.9rem;border:1.5px solid var(--beige2);border-radius:10px;font-size:0.92rem;color:var(--text);background:var(--beige);outline:none;font-family:'DM Sans',sans-serif;}
  .field input:focus{border-color:var(--peach2);background:var(--white);}
  .btn-main{width:100%;padding:0.78rem;background:linear-gradient(135deg,var(--peach2),#d4906a);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:500;cursor:pointer;margin-top:0.3rem;font-family:'DM Sans',sans-serif;}
  .err{background:#fde8e8;color:#a33;border-radius:9px;padding:0.55rem 0.9rem;font-size:0.82rem;margin-bottom:0.9rem;}
  .ov{position:fixed;inset:0;background:rgba(61,46,34,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:1rem;}
  .modal{background:var(--white);border-radius:22px;padding:1.75rem;max-width:380px;width:100%;}
  .modal h2{font-family:'Lora',serif;margin-bottom:0.6rem;font-size:1.2rem;}
  .modal p{color:var(--text2);font-size:0.87rem;line-height:1.6;margin-bottom:0.75rem;}
  .modal a{color:#6366f1;text-decoration:none;font-weight:500;}
  .steps{color:var(--text2);font-size:0.85rem;line-height:2;padding-left:1.2rem;margin-bottom:1rem;}
  .mact{display:flex;gap:0.6rem;}
  .btn-sec{flex:1;padding:0.65rem;background:var(--beige2);border:none;border-radius:10px;font-size:0.88rem;color:var(--text2);cursor:pointer;font-family:'DM Sans',sans-serif;}
  .btn-gold{flex:1;padding:0.65rem;background:linear-gradient(135deg,#f2c45a,#e8a828);color:#fff;border:none;border-radius:10px;font-size:0.88rem;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .snote{font-size:0.72rem;color:var(--text3);text-align:center;margin-top:0.65rem;font-style:italic;}
  @keyframes bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}
`;

function Auth({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    if (!email || !pass) return setErr("Please fill in all fields.");
    const users = DB.getUsers();
    if (tab === "signup") {
      if (users[email]) return setErr("Email already registered.");
      if (pass.length < 6)
        return setErr("Password must be at least 6 characters.");
      const uid = `u_${Date.now()}`;
      users[email] = {
        uid,
        email,
        name: name || email.split("@")[0],
        password: pass,
      };
      DB.saveUsers(users);
      DB.saveSub(uid, { status: "free", expiry_date: null });
      DB.saveSession(uid);
      onLogin({ ...users[email] });
    } else {
      const u = users[email];
      if (!u || u.password !== pass)
        return setErr("Invalid email or password.");
      DB.saveSession(u.uid);
      onLogin({ ...u });
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <span>🌿</span>
          <h1>Saathi AI</h1>
          <p>Your calm emotional companion</p>
        </div>
        <div className="tabs">
          <button
            className={`tab ${tab === "login" ? "active" : ""}`}
            onClick={() => {
              setTab("login");
              setErr("");
            }}
          >
            Sign In
          </button>
          <button
            className={`tab ${tab === "signup" ? "active" : ""}`}
            onClick={() => {
              setTab("signup");
              setErr("");
            }}
          >
            Sign Up
          </button>
        </div>
        {err && <div className="err">{err}</div>}
        {tab === "signup" && (
          <div className="field">
            <label>Name</label>
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            placeholder="hello@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <button className="btn-main" onClick={submit}>
          {tab === "login" ? "Sign In" : "Create Account"}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [chats, setChats] = useState(() => DB.getChats(user.uid));
  const [sub, setSub] = useState(() => DB.getSub(user.uid));
  const [selMood, setSelMood] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showApi, setShowApi] = useState(false);
  const [apiKey, setApiKey] = useState(() => DB.getApiKey());
  const [tempKey, setTempKey] = useState("");
  const endRef = useRef(null);

  const isPremium = sub.status === "premium";
  const dayCount = todayCount(chats);
  const limitHit = !isPremium && dayCount >= 20;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, loading]);

  const pickMood = (m) => {
    setSelMood(m);
    const moods = DB.getMoods(user.uid);
    DB.saveMoods(user.uid, [
      ...moods,
      { id: Date.now(), mood: m.label, created_at: new Date().toISOString() },
    ]);
  };

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    if (!apiKey) {
      setShowApi(true);
      return;
    }
    if (limitHit) {
      setShowUpgrade(true);
      return;
    }

    const text = input.trim();
    setInput("");

    if (hasCrisis(text)) {
      const um = {
        id: Date.now() - 1,
        role: "user",
        message: text,
        created_at: new Date().toISOString(),
      };
      const cm = {
        id: Date.now(),
        role: "assistant",
        crisis: true,
        message:
          "⚠️ Saathi AI is not crisis support. Please contact local emergency services or a mental health professional. In India, call iCall: 9152987821.",
        created_at: new Date().toISOString(),
      };
      const upd = [...chats, um, cm];
      setChats(upd);
      DB.saveChats(user.uid, upd);
      return;
    }

    const um = {
      id: Date.now(),
      role: "user",
      message: text,
      created_at: new Date().toISOString(),
    };
    const upd = [...chats, um];
    setChats(upd);
    DB.saveChats(user.uid, upd);
    setLoading(true);

    try {
      const reply = await callGroq(apiKey, chats, text);
      const am = {
        id: Date.now(),
        role: "assistant",
        message: reply,
        created_at: new Date().toISOString(),
      };
      const final = [...upd, am];
      setChats(final);
      DB.saveChats(user.uid, final);
    } catch (e) {
      const em = {
        id: Date.now(),
        role: "assistant",
        message: `Error: ${e.message}`,
        created_at: new Date().toISOString(),
      };
      const final = [...upd, em];
      setChats(final);
      DB.saveChats(user.uid, final);
    } finally {
      setLoading(false);
    }
  }, [input, loading, apiKey, limitHit, chats, user.uid]);

  const upgrade = () => {
    const ns = {
      status: "premium",
      expiry_date: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
    setSub(ns);
    DB.saveSub(user.uid, ns);
    setShowUpgrade(false);
  };

  const saveKey = () => {
    if (!tempKey.trim()) return;
    DB.saveApiKey(tempKey.trim());
    setApiKey(tempKey.trim());
    setShowApi(false);
    setTempKey("");
  };

  return (
    <div className="wrap">
      <div className="hdr">
        <div className="hdr-l">
          🌿 Saathi AI{" "}
          <span className={`badge ${isPremium ? "premium" : "free"}`}>
            {isPremium ? "✦ Premium" : "Free"}
          </span>{" "}
          <span className="groq-badge">⚡ Groq</span>
        </div>
        <div className="hdr-r">
          {!isPremium && <span className="cnt">{dayCount}/20 today</span>}
          <button
            className="btn-sm"
            onClick={() => {
              DB.clearSession();
              onLogout();
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mood">
        <h3>How are you feeling today?</h3>
        <div className="mood-row">
          {MOODS.map((m) => (
            <button
              key={m.label}
              className={`mbtn ${selMood?.label === m.label ? "sel" : ""}`}
              onClick={() => pickMood(m)}
              title={m.label}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-box">
        <div className="msgs">
          {chats.length === 0 && (
            <div className="empty">
              <span className="ic">🌸</span>
              <p>I'm here for you. Tell me how you're doing.</p>
            </div>
          )}
          {chats.map((c) => (
            <div key={c.id} className={`bw ${c.role === "user" ? "u" : ""}`}>
              <div className={`av ${c.role === "user" ? "u" : "ai"}`}>
                {c.role === "user" ? "😊" : "🌿"}
              </div>
              <div
                className={`bbl ${c.role === "user" ? "u" : "ai"} ${
                  c.crisis ? "cr" : ""
                }`}
              >
                {c.message}
                <time>{fmt(c.created_at)}</time>
              </div>
            </div>
          ))}
          {loading && (
            <div className="bw">
              <div className="av ai">🌿</div>
              <div className="bbl ai">
                <div className="typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="ibar">
          {!isPremium && (
            <button className="btn-up" onClick={() => setShowUpgrade(true)}>
              ✦ Upgrade
            </button>
          )}
          <textarea
            rows={1}
            placeholder={
              limitHit
                ? "Daily limit reached. Upgrade to continue."
                : "Share what's on your mind…"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={limitHit || loading}
          />
          <button
            className="btn-send"
            onClick={send}
            disabled={!input.trim() || loading || limitHit}
          >
            ➤
          </button>
        </div>
      </div>

      {showUpgrade && (
        <div className="ov" onClick={() => setShowUpgrade(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>✦ Upgrade to Premium</h2>
            <p>
              You've used your 20 free messages today. Upgrade for unlimited
              conversations.
            </p>
            <div className="mact">
              <button className="btn-sec" onClick={() => setShowUpgrade(false)}>
                Maybe later
              </button>
              <button className="btn-gold" onClick={upgrade}>
                Upgrade Now
              </button>
            </div>
            <p className="snote">Powered by Stripe · Secure · Cancel anytime</p>
          </div>
        </div>
      )}

      {showApi && (
        <div className="ov">
          <div className="modal">
            <h2>⚡ Groq API Key — Free!</h2>
            <p>Get your free key in 1 minute:</p>
            <ol className="steps">
              <li>
                Go to{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  console.groq.com/keys
                </a>
              </li>
              <li>Sign up free with Google</li>
              <li>
                Click <strong>"Create API Key"</strong>
              </li>
              <li>Copy & paste below</li>
            </ol>
            <div className="field">
              <label>Groq API Key</label>
              <input
                type="password"
                placeholder="gsk_..."
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveKey()}
              />
            </div>
            <div className="mact">
              <button className="btn-sec" onClick={() => setShowApi(false)}>
                Cancel
              </button>
              <button className="btn-gold" onClick={saveKey}>
                Save & Start Chatting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const uid = DB.getSession();
    if (!uid) return null;
    return Object.values(DB.getUsers()).find((u) => u.uid === uid) || null;
  });

  return (
    <>
      <style>{css}</style>
      {user ? (
        <Dashboard user={user} onLogout={() => setUser(null)} />
      ) : (
        <Auth onLogin={(u) => setUser(u)} />
      )}
    </>
  );
}
