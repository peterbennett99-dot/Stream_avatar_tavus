import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";

// ── Provider ──────────────────────────────────────────────────────────────────
type Provider = "heygen" | "tavus";
let activeProvider: Provider = "heygen";

// ── Env ───────────────────────────────────────────────────────────────────────
const ENV_API_KEY           = import.meta.env.LIVEAVATAR_API_KEY   as string | undefined;
const ENV_ELEVENLABS_SECRET = import.meta.env.ELEVENLABS_SECRET_ID as string | undefined;
const ENV_ELEVENLABS_AGENT  = import.meta.env.ELEVENLABS_AGENT_ID  as string | undefined;

// ── DOM refs — shared ─────────────────────────────────────────────────────────
const providerBtns     = document.querySelectorAll<HTMLButtonElement>(".provider-btn");
const heygenFields     = document.getElementById("heygen-fields")!   as HTMLDivElement;
const tavusFields      = document.getElementById("tavus-fields")!    as HTMLDivElement;
const btnStart         = document.getElementById("btn-start")!       as HTMLButtonElement;
const btnStop          = document.getElementById("btn-stop")!        as HTMLButtonElement;
const btnSpeak         = document.getElementById("btn-speak")!       as HTMLButtonElement;
const btnInterrupt     = document.getElementById("btn-interrupt")!   as HTMLButtonElement;
const btnListen        = document.getElementById("btn-listen")!      as HTMLButtonElement;
const speakInput       = document.getElementById("speak-input")!     as HTMLInputElement;
const videoEl          = document.getElementById("avatar-video")!    as HTMLVideoElement;
const tavusFrame       = document.getElementById("tavus-frame")!     as HTMLIFrameElement;
const videoContainer   = document.getElementById("video-container")! as HTMLDivElement;
const controlsEl       = document.getElementById("controls")!        as HTMLDivElement;
const speakRowEl       = document.getElementById("speak-row")!       as HTMLDivElement;
const setupEl          = document.getElementById("setup")!           as HTMLDivElement;
const providerSelector = document.getElementById("provider-selector")! as HTMLDivElement;
const logEl            = document.getElementById("log")!             as HTMLDivElement;
const statusDot        = document.getElementById("status-dot")!      as HTMLDivElement;
const statusText       = document.getElementById("status-text")!     as HTMLSpanElement;
const transcriptEl     = document.getElementById("transcript-overlay")! as HTMLDivElement;
const providerBadge    = document.getElementById("provider-badge")!  as HTMLDivElement;

// ── DOM refs — HeyGen ─────────────────────────────────────────────────────────
const apiKeyInput           = document.getElementById("api-key")!             as HTMLInputElement;
const elevenLabsSecretInput = document.getElementById("elevenlabs-secret-id")! as HTMLInputElement;
const elevenLabsAgentInput  = document.getElementById("elevenlabs-agent-id")!  as HTMLInputElement;
const avatarIdInput         = document.getElementById("avatar-id")!            as HTMLInputElement;
const sandboxToggle         = document.getElementById("sandbox-toggle")!       as HTMLInputElement;

// ── DOM refs — Tavus ──────────────────────────────────────────────────────────
const tavusApiKeyInput      = document.getElementById("tavus-api-key")!            as HTMLInputElement;
const tavusReplicaIdInput   = document.getElementById("tavus-replica-id")!         as HTMLInputElement;
const tavusPersonaIdInput   = document.getElementById("tavus-persona-id")!         as HTMLInputElement;
const tavusConvNameInput    = document.getElementById("tavus-conversation-name")!  as HTMLInputElement;

// ── LocalStorage keys ─────────────────────────────────────────────────────────
const LS = {
  apiKey:           "liveavatar_api_key",
  elevenSecret:     "elevenlabs_secret_id",
  elevenAgent:      "elevenlabs_agent_id",
  tavusApiKey:      "tavus_api_key",
  tavusReplicaId:   "tavus_replica_id",
  tavusPersonaId:   "tavus_persona_id",
  tavusConvName:    "tavus_conversation_name",
};

// ── Restore persisted values ──────────────────────────────────────────────────
function restore(input: HTMLInputElement, key: string, fallback?: string) {
  const val = localStorage.getItem(key) || fallback || "";
  if (val) input.value = val;
}
restore(apiKeyInput,           LS.apiKey,       ENV_API_KEY);
restore(elevenLabsSecretInput, LS.elevenSecret, ENV_ELEVENLABS_SECRET);
restore(elevenLabsAgentInput,  LS.elevenAgent,  ENV_ELEVENLABS_AGENT);
restore(tavusApiKeyInput,      LS.tavusApiKey);
restore(tavusReplicaIdInput,   LS.tavusReplicaId);
restore(tavusPersonaIdInput,   LS.tavusPersonaId);
restore(tavusConvNameInput,    LS.tavusConvName);

function persist(input: HTMLInputElement, key: string) {
  input.addEventListener("change", () => {
    const v = input.value.trim();
    if (v) localStorage.setItem(key, v);
    else   localStorage.removeItem(key);
  });
}
persist(apiKeyInput,           LS.apiKey);
persist(elevenLabsSecretInput, LS.elevenSecret);
persist(elevenLabsAgentInput,  LS.elevenAgent);
persist(tavusApiKeyInput,      LS.tavusApiKey);
persist(tavusReplicaIdInput,   LS.tavusReplicaId);
persist(tavusPersonaIdInput,   LS.tavusPersonaId);
persist(tavusConvNameInput,    LS.tavusConvName);

// ── Provider toggle ───────────────────────────────────────────────────────────
providerBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const p = btn.dataset.provider as Provider;
    activeProvider = p;
    providerBtns.forEach((b) => b.classList.toggle("active", b.dataset.provider === p));
    heygenFields.classList.toggle("hidden", p !== "heygen");
    tavusFields.classList.toggle("hidden",  p !== "tavus");
  });
});

// ── State ─────────────────────────────────────────────────────────────────────
let heygenSession: LiveAvatarSession | null = null;
let tavusConversationId: string | null = null;
let isListening = false;

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg: string, type: "info" | "event" | "error" = "info") {
  const p = document.createElement("p");
  p.className = type;
  p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text: string, dot: "loading" | "connected" | "error" | "") {
  statusText.textContent = text;
  statusDot.className = dot;
}

function setTranscript(speaker: "You" | "Avatar", text: string) {
  transcriptEl.textContent = `${speaker}: ${text}`;
}

// ── Show/hide panels ──────────────────────────────────────────────────────────
function showSession(provider: Provider) {
  setupEl.style.display = "none";
  providerSelector.style.display = "none";
  videoContainer.style.display = "block";
  controlsEl.style.display = "flex";
  logEl.style.display = "block";
  btnStart.style.display = "none";
  btnStop.style.display = "inline-block";

  // HeyGen shows video + speak row; Tavus embeds full iframe (no speak row)
  videoEl.style.display     = provider === "heygen" ? "block" : "none";
  tavusFrame.style.display  = provider === "tavus"  ? "block" : "none";
  speakRowEl.style.display  = provider === "heygen" ? "flex"  : "none";
  btnInterrupt.style.display = provider === "heygen" ? "inline-block" : "none";
  btnListen.style.display    = provider === "heygen" ? "inline-block" : "none";

  providerBadge.textContent = provider === "heygen" ? "HEYGEN" : "TAVUS";
  providerBadge.className   = provider;
}

function showSetup() {
  setupEl.style.display = "flex";
  providerSelector.style.display = "flex";
  videoContainer.style.display = "none";
  controlsEl.style.display = "none";
  speakRowEl.style.display = "none";
  logEl.style.display = "none";
  btnStart.style.display = "inline-block";
  btnStop.style.display = "none";
  transcriptEl.textContent = "";
  tavusFrame.src = "";
}

// ── HeyGen: create session token ──────────────────────────────────────────────
async function createHeyGenToken(
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
    throw new Error((err as any).message ?? `Token request failed: ${res.status}`);
  }

  const body = await res.json();
  return body.data.session_token as string;
}

// ── Tavus: create conversation ────────────────────────────────────────────────
async function createTavusConversation(
  apiKey: string,
  replicaId: string,
  personaId: string,
  conversationName?: string,
): Promise<{ conversation_id: string; conversation_url: string }> {
  const body: Record<string, string> = {
    replica_id: replicaId,
    persona_id: personaId,
  };
  if (conversationName) body.conversation_name = conversationName;

  const res = await fetch("https://tavusapi.com/v2/conversations", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `Tavus request failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    conversation_id: data.conversation_id as string,
    conversation_url: data.conversation_url as string,
  };
}

// ── Tavus: end conversation ───────────────────────────────────────────────────
async function endTavusConversation(apiKey: string, conversationId: string) {
  await fetch(`https://tavusapi.com/v2/conversations/${conversationId}/end`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
  }).catch(() => {});
}

// ── Start ─────────────────────────────────────────────────────────────────────
btnStart.addEventListener("click", async () => {
  btnStart.disabled = true;

  if (activeProvider === "heygen") {
    await startHeyGen();
  } else {
    await startTavus();
  }
});

async function startHeyGen() {
  const apiKey             = apiKeyInput.value.trim();
  const avatarId           = avatarIdInput.value.trim();
  const elevenLabsSecretId = elevenLabsSecretInput.value.trim();
  const elevenLabsAgentId  = elevenLabsAgentInput.value.trim();
  const sandbox            = sandboxToggle.checked;

  if (!apiKey)             { alert("Please enter your LiveAvatar API key."); btnStart.disabled = false; return; }
  if (!avatarId)           { alert("Please enter an Avatar ID."); btnStart.disabled = false; return; }
  if (!elevenLabsSecretId || !elevenLabsAgentId) {
    alert("Please enter your ElevenLabs Secret ID and Agent ID.");
    btnStart.disabled = false;
    return;
  }

  setStatus("Creating token…", "loading");
  showSession("heygen");
  log("Creating HeyGen session token…");

  try {
    const sessionToken = await createHeyGenToken(apiKey, avatarId, sandbox, elevenLabsSecretId, elevenLabsAgentId);
    log("Token created. Starting session…");
    setStatus("Connecting…", "loading");

    heygenSession = new LiveAvatarSession(sessionToken, { voiceChat: true });

    heygenSession.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
      log(`State → ${state}`, "event");
      if (state === SessionState.CONNECTED) {
        setStatus("Connected", "loading");
      } else if (state === SessionState.DISCONNECTED) {
        setStatus("Disconnected", "error");
        cleanupHeyGen();
      }
    });

    heygenSession.on(SessionEvent.SESSION_STREAM_READY, () => {
      log("Stream ready — attaching video", "event");
      heygenSession!.attach(videoEl);
      videoEl.muted = false;
      setStatus("Live", "connected");
    });

    heygenSession.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
      log(`Disconnected: ${reason}`, "error");
      cleanupHeyGen();
    });

    heygenSession.on(AgentEventsEnum.USER_SPEAK_STARTED, () => log("You: speaking…", "event"));
    heygenSession.on(AgentEventsEnum.USER_TRANSCRIPTION,  (e) => { log(`You: "${e.text}"`, "info"); setTranscript("You", e.text); });
    heygenSession.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => log("Avatar: speaking…", "event"));
    heygenSession.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (e) => { log(`Avatar: "${e.text}"`, "info"); setTranscript("Avatar", e.text); });
    heygenSession.on(AgentEventsEnum.AVATAR_SPEAK_ENDED,   () => log("Avatar: finished speaking", "event"));

    await heygenSession.start();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Error: ${msg}`, "error");
    setStatus("Error", "error");
    cleanupHeyGen();
    btnStart.disabled = false;
  }
}

async function startTavus() {
  const apiKey           = tavusApiKeyInput.value.trim();
  const replicaId        = tavusReplicaIdInput.value.trim();
  const personaId        = tavusPersonaIdInput.value.trim();
  const conversationName = tavusConvNameInput.value.trim();

  if (!apiKey)    { alert("Please enter your Tavus API key."); btnStart.disabled = false; return; }
  if (!replicaId) { alert("Please enter a Tavus Replica ID."); btnStart.disabled = false; return; }
  if (!personaId) { alert("Please enter a Tavus Persona ID."); btnStart.disabled = false; return; }

  setStatus("Creating conversation…", "loading");
  showSession("tavus");
  log("Creating Tavus conversation…");

  try {
    const { conversation_id, conversation_url } = await createTavusConversation(
      apiKey, replicaId, personaId, conversationName || undefined
    );

    tavusConversationId = conversation_id;
    log(`Conversation created: ${conversation_id}`, "event");
    log("Loading video room…");
    setStatus("Connecting…", "loading");

    tavusFrame.src = conversation_url;
    tavusFrame.onload = () => {
      setStatus("Live", "connected");
      log("Tavus conversation live", "event");
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Error: ${msg}`, "error");
    setStatus("Error", "error");
    cleanupTavus();
    btnStart.disabled = false;
  }
}

// ── Stop ──────────────────────────────────────────────────────────────────────
btnStop.addEventListener("click", async () => {
  btnStop.disabled = true;
  log("Stopping session…");

  if (activeProvider === "heygen" && heygenSession) {
    try { await heygenSession.stop(); } catch { cleanupHeyGen(); }
  } else if (activeProvider === "tavus" && tavusConversationId) {
    const apiKey = tavusApiKeyInput.value.trim();
    await endTavusConversation(apiKey, tavusConversationId);
    log("Tavus conversation ended", "event");
    cleanupTavus();
  }
});

// ── HeyGen controls ───────────────────────────────────────────────────────────
btnSpeak.addEventListener("click", () => {
  const text = speakInput.value.trim();
  if (!text || !heygenSession) return;
  heygenSession.message(text);
  log(`Sent to agent: "${text}"`);
  speakInput.value = "";
});

speakInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnSpeak.click();
});

btnInterrupt.addEventListener("click", () => {
  if (!heygenSession) return;
  heygenSession.interrupt();
  log("Interrupted avatar", "event");
});

btnListen.addEventListener("click", () => {
  if (!heygenSession) return;
  if (isListening) {
    heygenSession.stopListening();
    isListening = false;
    btnListen.textContent = "Start Listening";
    log("Stopped listening", "event");
  } else {
    heygenSession.startListening();
    isListening = true;
    btnListen.textContent = "Stop Listening";
    log("Started listening", "event");
  }
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
function cleanupHeyGen() {
  heygenSession = null;
  isListening = false;
  btnListen.textContent = "Start Listening";
  btnStart.disabled = false;
  btnStop.disabled = false;
  showSetup();
}

function cleanupTavus() {
  tavusConversationId = null;
  btnStart.disabled = false;
  btnStop.disabled = false;
  showSetup();
}
