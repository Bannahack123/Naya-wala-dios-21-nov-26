import React, { useState, useEffect } from "react";
import {
  Settings, Key, Terminal, Copy, Check, X,
  Play, Rocket, BookOpen, ShieldCheck
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [cfEmail, setCfEmail] = useState(() => {
    try {
      return localStorage.getItem("dios_settings_cf_email") || "";
    } catch {
      return "";
    }
  });

  const [cfKey, setCfKey] = useState(() => {
    try {
      return localStorage.getItem("dios_settings_cf_key") || "";
    } catch {
      return "";
    }
  });

  const [rememberOnIpad, setRememberOnIpad] = useState(() => {
    try {
      return localStorage.getItem("dios_settings_remember_keys") === "true";
    } catch {
      return false;
    }
  });

  const [copiedWakeCmd, setCopiedWakeCmd] = useState(false);
  const [copiedNewCsScript, setCopiedNewCsScript] = useState(false);

  useEffect(() => {
    if (rememberOnIpad) {
      try {
        localStorage.setItem("dios_settings_cf_email", cfEmail);
        localStorage.setItem("dios_settings_cf_key", cfKey);
        localStorage.setItem("dios_settings_remember_keys", "true");
      } catch {}
    } else {
      try {
        localStorage.removeItem("dios_settings_cf_email");
        localStorage.removeItem("dios_settings_cf_key");
        localStorage.setItem("dios_settings_remember_keys", "false");
      } catch {}
    }
  }, [rememberOnIpad, cfEmail, cfKey]);

  if (!isOpen) return null;

  // 1. Same Codespace Wake-Up Command (5-second restart)
  const wakeUpCommand = [
    'cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
    'pkill -9 -f uvicorn 2>/dev/null || true; fuser -k 8000/tcp 2>/dev/null || true',
    'PYTHONUNBUFFERED=1 nohup python3 -u -m uvicorn server:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &',
    'sleep 2 && gh codespace ports visibility 8000:public -c "$CODESPACE_NAME" 2>/dev/null || true',
    'curl -s http://127.0.0.1:8000/api/terminal-logs | head -c 140 && echo ""'
  ].join("\n");

  // Optional Cloudflare export lines if manually filled in form
  const optionalCfExports = [
    cfEmail.trim() ? `export CLOUDFLARE_EMAIL="${cfEmail.trim()}"` : "",
    cfKey.trim() ? `export CLOUDFLARE_API_KEY="${cfKey.trim()}"` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const cfExportBlock = optionalCfExports ? `${optionalCfExports}\n` : "";

  // 2. New Codespace 1-Click Full Setup + Deploy Command (iPad Safari safe, no emojis inside heredoc)
  const newCodespaceCommand = `cat << 'EOF' > /tmp/new_codespace_setup.sh
#!/bin/bash
set -e
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ ! -f "requirements.txt" ]; then
  ZIP_FILE=$(ls -1 *.zip 2>/dev/null | head -n 1)
  if [ -n "$ZIP_FILE" ]; then
    echo "[1/5] Extracting $ZIP_FILE..."
    rm -rf /tmp/dios_unzip
    unzip -oq "$ZIP_FILE" -d /tmp/dios_unzip
    INNER_DIR=$(find /tmp/dios_unzip -mindepth 1 -maxdepth 1 -type d | head -n 1)
    cp -a "\${INNER_DIR:-/tmp/dios_unzip}"/. .
    rm -rf /tmp/dios_unzip
  fi
fi

echo "[2/5] Updating Codespace URL & server paths..."
python3 - << 'PYEOF'
import os, glob, re
cs = os.environ.get("CODESPACE_NAME", "")
new_api = f"https://{cs}-8000.app.github.dev" if cs else "http://127.0.0.1:8000"
for p in glob.glob("functions/api/*.ts") + ["src/config.ts"]:
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8", errors="ignore") as f:
            s = f.read()
        s = re.sub(r"https://[a-zA-Z0-9-]+-8000\\.app\\.github\\.dev", new_api, s)
        with open(p, "w", encoding="utf-8") as f:
            f.write(s)
if os.path.exists("server.py"):
    with open("server.py", "r", encoding="utf-8", errors="ignore") as f:
        s = f.read()
    s = re.sub(r'^SERVER_LOG_FILE\\s*=.*$', 'SERVER_LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.log")', s, flags=re.M)
    with open("server.py", "w", encoding="utf-8") as f:
        f.write(s)
print("New Backend URL ->", new_api)
PYEOF

echo "[3/5] Installing Python, Playwright & Node dependencies..."
pip install -q -r requirements.txt
sudo playwright install-deps chromium || playwright install-deps chromium || true
playwright install chromium
npm install --silent || npm install --legacy-peer-deps

echo "[4/5] Starting Port 8000 Backend..."
pkill -9 -f uvicorn 2>/dev/null || true
fuser -k 8000/tcp 2>/dev/null || true
sleep 1
PYTHONUNBUFFERED=1 nohup python3 -u -m uvicorn server:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
sleep 3
gh codespace ports visibility 8000:public -c "$CODESPACE_NAME" 2>/dev/null || true
curl -s http://127.0.0.1:8000/api/terminal-logs | head -c 140 && echo ""

echo "[5/5] Building & Deploying to dios-hub.pages.dev..."
unset CLOUDFLARE_API_TOKEN 2>/dev/null || true
${cfExportBlock}npm run build
npx wrangler pages deploy dist --project-name=dios-hub --branch=main --commit-dirty=true
EOF
bash /tmp/new_codespace_setup.sh`;

  const handleCopyWakeCmd = () => {
    navigator.clipboard.writeText(wakeUpCommand);
    setCopiedWakeCmd(true);
    setTimeout(() => setCopiedWakeCmd(false), 2500);
  };

  const handleCopyNewCsScript = () => {
    navigator.clipboard.writeText(newCodespaceCommand);
    setCopiedNewCsScript(true);
    setTimeout(() => setCopiedNewCsScript(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
      <div className="bg-slate-900 border-2 border-cyan-500/60 rounded-3xl max-w-3xl w-full p-5 md:p-6 shadow-2xl flex flex-col max-h-[92vh]">

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 text-white rounded-xl shadow-lg">
              <Settings size={22} />
            </span>
            <div>
              <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                Settings &amp; Server Quick Launcher
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  1-Click Live
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Codespace Wake-Up &bull; New Codespace Full Setup &bull; Cloudflare Guide
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">

          {/* 1. SAME CODESPACE QUICK WAKE-UP */}
          <div className="p-4 bg-slate-950 rounded-2xl border-2 border-emerald-500/60 shadow-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Play size={14} className="text-emerald-400" />
                ⚡ Same Codespace Wake-Up (Port 8000 Restart):
              </span>

              <button
                onClick={handleCopyWakeCmd}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950 transition cursor-pointer active:scale-95"
              >
                {copiedWakeCmd ? <Check size={14} className="text-yellow-300" /> : <Copy size={14} />}
                <span>{copiedWakeCmd ? "✅ COPIED WAKE-UP CODE!" : "📋 COPY WAKE-UP CODE"}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Jab purana Codespace sleep hokar dubara khule, tab sirf ye command chalayein (deploy ki zaroorat nahi).
            </p>

            <div className="p-3 bg-black rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 select-all whitespace-pre-wrap leading-relaxed shadow-inner overflow-x-auto">
              {wakeUpCommand}
            </div>
          </div>

          {/* 2. NEW CODESPACE FULL SETUP & DEPLOY */}
          <div className="p-4 bg-slate-950 rounded-2xl border-2 border-cyan-500/60 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Rocket size={14} className="text-cyan-400" />
                🚀 New Codespace 1-Click Full Setup &amp; Cloudflare Deploy:
              </span>

              <button
                onClick={handleCopyNewCsScript}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-950 transition cursor-pointer active:scale-95"
              >
                {copiedNewCsScript ? <Check size={14} className="text-yellow-300" /> : <Copy size={14} />}
                <span>{copiedNewCsScript ? "✅ COPIED FULL SCRIPT!" : "📋 COPY NEW CODESPACE SCRIPT"}</span>
              </button>
            </div>

            {/* Step-by-Step Full Guide */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-[11px] text-slate-300">
              <div className="font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                <BookOpen size={13} /> Full Guide (Jab Naya Codespace Banayein):
              </div>
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                <li>
                  <span className="font-semibold text-white">GitHub Secrets (1 Baar):</span> Repo{" "}
                  <span className="font-mono text-cyan-300">Settings &rarr; Secrets and variables &rarr; Codespaces</span>{" "}
                  me <span className="font-mono text-emerald-300">CLOUDFLARE_EMAIL</span> aur{" "}
                  <span className="font-mono text-emerald-300">CLOUDFLARE_API_KEY</span> (37-char Global API Key) save rakhein.{" "}
                  <span className="text-slate-400">(Actions me nahi, Codespaces me.)</span>
                </li>
                <li>
                  <span className="font-semibold text-white">Paste &amp; Run:</span> Naye Codespace terminal me upar wala{" "}
                  <span className="text-cyan-300 font-semibold">COPY NEW CODESPACE SCRIPT</span> button dabakar paste karein.
                  Ye khud zip extract, URL update, Playwright install, Port 8000 start aur Cloudflare deploy kar dega.
                </li>
                <li>
                  <span className="font-semibold text-white">Port 8000 Public Check:</span> VS Code ke{" "}
                  <span className="font-mono text-cyan-300">Ports</span> tab me confirm karein ki Port{" "}
                  <span className="font-mono text-yellow-300">8000</span> ki Visibility{" "}
                  <span className="text-emerald-300 font-semibold">Public</span> ho.
                </li>
                <li>
                  <span className="font-semibold text-white">Live Use:</span> Ab{" "}
                  <span className="font-mono text-cyan-300">https://dios-hub.pages.dev</span> khol kar Live Fetch + Cloud Sync use karein!
                </li>
              </ol>
            </div>

            <div className="p-3 bg-black rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-200 select-all whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto shadow-inner">
              {newCodespaceCommand}
            </div>
          </div>

          {/* 3. OPTIONAL CLOUDFLARE CREDENTIALS OVERRIDE */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Key size={13} className="text-amber-400" /> Optional Cloudflare Credentials (Agar GitHub Secrets Set Nahi Hai):
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 font-normal cursor-pointer normal-case">
                <input
                  type="checkbox"
                  checked={rememberOnIpad}
                  onChange={e => setRememberOnIpad(e.target.checked)}
                  className="rounded text-cyan-500"
                />
                <span>Remember in iPad LocalStorage?</span>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
              <span>
                Agar aapne GitHub Codespaces Secrets me keys daal rakhi hain toh inhe khali chhod dein. (Namespace ID{" "}
                <span className="font-mono text-slate-300">287bbf...</span> nahi, Global API Key daalein.)
              </span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Cloudflare Email:</label>
                <input
                  type="text"
                  value={cfEmail}
                  onChange={e => setCfEmail(e.target.value)}
                  placeholder="e.g. litx18kyt@gmail.com"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Global API Key (37-char):</label>
                <input
                  type="password"
                  value={cfKey}
                  onChange={e => setCfKey(e.target.value)}
                  placeholder="Khali chhodein agar Secrets me hai..."
                  className="w-full bg-slate-900 border border-slate-700 text-yellow-300 rounded-xl px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Terminal size={13} className="text-emerald-400" />
            <span>Same Codespace = Green Wake-Up &bull; New Codespace = Blue Full Setup</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
