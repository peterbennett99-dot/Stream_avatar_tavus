import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";

// ── Env ───────────────────────────────────────────────────────────────────────
const ENV_API_KEY             = import.meta.env.LIVEAVATAR_API_KEY      as string | undefined;
const ENV_ELEVENLABS_SECRET   = import.meta.env.ELEVENLABS_SECRET_ID    as string | undefined;
const ENV_ELEVENLABS_AGENT    = import.meta.env.ELEVENLABS_AGENT_ID     as string | undefined;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const apiKeyInput          = document.getElementById("api-key")               as HTMLInputElement;
const elevenLabsSecretInput = document.getElementById("elevenlabs-secret-id") as HTMLInputElement;
const elevenLabsAgentInput  = document.getElementById("elevenlabs-agent-id")  as HTMLInputElement;
const avatarIdInput         = document.getElementById("avatar-id")            as HTMLInputElement;
const sandboxToggle  = document.getElementById("sandbox-toggle") as HTMLInputElement;
const btnStart       = document.getElementById("btn-start")     as HTMLButtonElement;
const btnStop        = document.getElementById("btn-stop")      as HTMLButtonElement;
const btnSpeak       = document.getElementById("btn-speak")     as HTMLButtonElement;
const btnInterrupt   = document.getElementById("btn-interrupt") as HTMLButtonElement;
const btnListen      = document.getElementById("btn-listen")    as HTMLButtonElement;
const speakInput     = document.getElementById("speak-input")   as HTMLInputElement;
const videoEl        = document.getElementById("avatar-video")  as HTMLVideoElement;
const videoContainer = document.getElementById("video-container") as HTMLDivElement;
const controlsEl     = document.getElementById("controls")       as HTMLDivElement;
const speakRowEl     = document.getElementById("speak-row")      as HTMLDivElement;
const setupEl        = document.getElementById("setup")          as HTMLDivElement;
const logEl          = document.getElementById("log")            as HTMLDivElement;
const statusDot      = document.getElementById("status-dot")    as HTMLDivElement;
const statusText     = document.getElementById("status-text")   as HTMLSpanElement;
const transcriptEl   = document.getElementById("transcript-overlay") as HTMLDivElement;

// ── Persist fields via localStorage (falls back to .env) ─────────────────────
const LS_API_KEY             = "liveavatar_api_key";
const LS_ELEVENLABS_SECRET   = "elevenlabs_secret_id";
const LS_ELEVENLABS_AGENT    = "elevenlabs_agent_id";
const savedKey              = localStorage.getItem(LS_API_KEY)           || ENV_API_KEY           || "";
const savedElevenLabsSecret = localStorage.getItem(LS_ELEVENLABS_SECRET) || ENV_ELEVENLABS_SECRET || "";
const savedElevenLabsAgent  = localStorage.getItem(LS_ELEVENLABS_AGENT)  || ENV_ELEVENLABS_AGENT  || "";

if (savedKey)              { apiKeyInput.value           = savedKey;              apiKeyInput.placeholder = "Loaded from saved key"; }
if (savedElevenLabsSecret) { elevenLabsSecretInput.value = savedElevenLabsSecret; }
if (savedElevenLabsAgent)  { elevenLabsAgentInput.value  = savedElevenLabsAgent;  }

apiKeyInput.addEventListener("change", () => {
  const val = apiKeyInput.value.trim();
  if (val) localStorage.setItem(LS_API_KEY, val);
  else localStorage.removeItem(LS_API_KEY);
});

elevenLabsSecretInput.addEventListener("change", () => {
  const val = elevenLabsSecretInput.value.trim();
  if (val) localStorage.setItem(LS_ELEVENLABS_SECRET, val);
  else localStorage.removeItem(LS_ELEVENLABS_SECRET);
});

elevenLabsAgentInput.addEventListener("change", () => {
  const val = elevenLabsAgentInput.value.trim();
  if (val) localStorage.setItem(LS_ELEVENLABS_AGENT, val);
  else localStorage.removeItem(LS_ELEVENLABS_AGENT);
});


// ── State ─────────────────────────────────────────────────────────────────────
let session: LiveAvatarSession | null = null;
let isListening = false;

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg: string, type: "info" | "event" | "error" = "info") {
  const p = document.createElement("p");
  p.className = type;
  p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function setStatus(text: string, dot: "loading" | "connected" | "error" | "") {
  statusText.textContent = text;
  statusDot.className = dot;
}

// ── Transcript overlay ────────────────────────────────────────────────────────
function setTranscript(speaker: "You" | "Avatar", text: string) {
  transcriptEl.textContent = `${speaker}: ${text}`;
}

// ── Show/hide panels ──────────────────────────────────────────────────────────
function showSession() {
  setupEl.style.display = "none";
  videoContainer.style.display = "block";
  controlsEl.style.display = "flex";
  speakRowEl.style.display = "flex";
  logEl.style.display = "block";
  btnStart.style.display = "none";
  btnStop.style.display = "inline-block";
}

function showSetup() {
  setupEl.style.display = "flex";
  videoContainer.style.display = "none";
  controlsEl.style.display = "none";
  speakRowEl.style.display = "none";
  logEl.style.display = "none";
  btnStart.style.display = "inline-block";
  btnStop.style.display = "none";
  transcriptEl.textContent = "";
}


// ── Token creation (calls your backend / LiveAvatar API directly) ─────────────
// In production this call should live on YOUR backend to keep the API key secret.
async function createSessionToken(
  apiKey: string,
  avatarId: string,
  isSandbox: boolean,
  elevenLabsSecretId: string,
  elevenLabsAgentId: string,
): Promise<string> {
  const res = await fetch("https://api.liveavatar.com/v1/sessions/token", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({
      mode: "LITE",
      avatar_id: avatarId,
      is_sandbox: isSandbox,
      elevenlabs_agent_config: {
        secret_id: elevenLabsSecretId,
        agent_id: elevenLabsAgentId,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Token request failed: ${res.status}`);
  }

  const body = await res.json();
  // API returns { code, data: { session_id, session_token } }
  return body.data.session_token as string;
}

// ── Start session ─────────────────────────────────────────────────────────────
btnStart.addEventListener("click", async () => {
  const apiKey             = apiKeyInput.value.trim();
  const avatarId           = avatarIdInput.value.trim();
  const elevenLabsSecretId = elevenLabsSecretInput.value.trim();
  const elevenLabsAgentId  = elevenLabsAgentInput.value.trim();
  const sandbox            = sandboxToggle.checked;

  if (!apiKey) {
    alert("Please enter your LiveAvatar API key.");
    return;
  }
  if (!avatarId) {
    alert("Please enter an avatar ID.");
    return;
  }
  if (!elevenLabsSecretId || !elevenLabsAgentId) {
    alert("Please enter your ElevenLabs Secret ID and Agent ID.");
    return;
  }

  btnStart.disabled = true;
  setStatus("Creating token…", "loading");
  showSession();
  log("Creating session token…");

  try {
    const sessionToken = await createSessionToken(apiKey, avatarId, sandbox, elevenLabsSecretId, elevenLabsAgentId);
    log("Token created. Starting session…");
    setStatus("Connecting…", "loading");

    session = new LiveAvatarSession(sessionToken, { voiceChat: true });

    // ── Session lifecycle events ──────────────────────────────────────────
    session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
      log(`State → ${state}`, "event");
      if (state === SessionState.CONNECTED) {
        setStatus("Connected", "loading"); // waiting for stream
      } else if (state === SessionState.DISCONNECTED) {
        setStatus("Disconnected", "error");
        cleanup();
      }
    });

    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      log("Stream ready — attaching video", "event");
      session!.attach(videoEl);
      videoEl.muted = false;
      setStatus("Live", "connected");
    });

    session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
      log(`Disconnected: ${reason}`, "error");
      cleanup();
    });

    // ── Agent / transcript events ─────────────────────────────────────────
    session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
      log("You: speaking…", "event");
    });

    session.on(AgentEventsEnum.USER_TRANSCRIPTION, (e) => {
      log(`You: "${e.text}"`, "info");
      setTranscript("You", e.text);
    });

    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      log("Avatar: speaking…", "event");
    });

    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (e) => {
      log(`Avatar: "${e.text}"`, "info");
      setTranscript("Avatar", e.text);
    });

    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      log("Avatar: finished speaking", "event");
    });

    await session.start();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Error: ${msg}`, "error");
    setStatus("Error", "error");
    console.error(err);
    cleanup();
    btnStart.disabled = false;
  }
});

// ── Stop ──────────────────────────────────────────────────────────────────────
btnStop.addEventListener("click", async () => {
  if (!session) return;
  btnStop.disabled = true;
  log("Stopping session…");
  try {
    await session.stop();
  } catch {
    cleanup();
  }
});

// ── Speak text ────────────────────────────────────────────────────────────────
btnSpeak.addEventListener("click", () => {
  const text = speakInput.value.trim();
  if (!text || !session) return;
  session.message(text);
  log(`Sent to agent: "${text}"`);
  speakInput.value = "";
});

speakInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnSpeak.click();
});


// ── Interrupt ─────────────────────────────────────────────────────────────────
btnInterrupt.addEventListener("click", () => {
  if (!session) return;
  session.interrupt();
  log("Interrupted avatar", "event");
});

// ── Listening toggle ──────────────────────────────────────────────────────────
btnListen.addEventListener("click", () => {
  if (!session) return;
  if (isListening) {
    session.stopListening();
    isListening = false;
    btnListen.textContent = "Start Listening";
    log("Stopped listening", "event");
  } else {
    session.startListening();
    isListening = true;
    btnListen.textContent = "Stop Listening";
    log("Started listening", "event");
  }
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
function cleanup() {
  session = null;
  isListening = false;
  btnListen.textContent = "Start Listening";
  btnStart.disabled = false;
  btnStop.disabled = false;
  showSetup();
}
