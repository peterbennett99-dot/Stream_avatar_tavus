// ── Types ─────────────────────────────────────────────────────────────────────
interface Replica {
  replica_id: string;
  replica_name: string;
  status: string;
  thumbnail_video_url?: string;
  created_at?: string;
}

interface Persona {
  persona_id: string;
  persona_name: string;
  system_prompt?: string;
  document_ids?: string[];
  created_at?: string;
}

interface TavusDocument {
  document_id: string;
  document_name: string;
  status?: string;
  tags?: string[];
  created_at?: string;
}

// ── DOM ───────────────────────────────────────────────────────────────────────
const apiKeyInput        = document.getElementById("api-key-input")!        as HTMLInputElement;
const btnLoad            = document.getElementById("btn-load")!              as HTMLButtonElement;
const apiStatus          = document.getElementById("api-status")!            as HTMLSpanElement;
const replicasBody       = document.getElementById("replicas-body")!         as HTMLDivElement;
const personasBody       = document.getElementById("personas-body")!         as HTMLDivElement;
const docsBody           = document.getElementById("docs-body")!             as HTMLDivElement;
const btnRefreshReplicas  = document.getElementById("btn-refresh-replicas")!  as HTMLButtonElement;
const btnRefreshPersonas  = document.getElementById("btn-refresh-personas")!  as HTMLButtonElement;
const btnRefreshDocs      = document.getElementById("btn-refresh-docs")!      as HTMLButtonElement;
const btnNewPersona       = document.getElementById("btn-new-persona")!       as HTMLButtonElement;
const createPersonaForm   = document.getElementById("create-persona-form")!   as HTMLDivElement;
const newPersonaName      = document.getElementById("new-persona-name")!      as HTMLInputElement;
const newPersonaPrompt    = document.getElementById("new-persona-prompt")!    as HTMLTextAreaElement;
const btnCreatePersona    = document.getElementById("btn-create-persona")!    as HTMLButtonElement;
const btnCancelPersona    = document.getElementById("btn-cancel-persona")!    as HTMLButtonElement;
const chipReplica        = document.getElementById("chip-replica")!          as HTMLSpanElement;
const chipPersona        = document.getElementById("chip-persona")!          as HTMLSpanElement;
const convNameInput      = document.getElementById("conv-name-input")!       as HTMLInputElement;
const btnLaunch          = document.getElementById("btn-launch")!            as HTMLButtonElement;
const btnEnd             = document.getElementById("btn-end")!               as HTMLButtonElement;
const convOverlay        = document.getElementById("conv-overlay")!          as HTMLDivElement;
const convFrame          = document.getElementById("conv-frame")!            as HTMLIFrameElement;
const convOverlayTitle   = document.getElementById("conv-overlay-title")!    as HTMLSpanElement;
const btnEndOverlay      = document.getElementById("btn-end-overlay")!       as HTMLButtonElement;
const toastEl            = document.getElementById("toast")!                 as HTMLDivElement;

// ── State ─────────────────────────────────────────────────────────────────────
const LS_KEY = "tavus_api_key";
let apiKey            = localStorage.getItem(LS_KEY) || "";
let selectedReplicaId = "";
let selectedPersonaId = "";
let activeConvId      = "";
let activeConvApiKey  = "";
let allPersonas: Persona[] = [];
let toastTimer: ReturnType<typeof setTimeout> | null = null;

if (apiKey) apiKeyInput.value = apiKey;

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg: string, type: "ok" | "error" | "" = "") {
  toastEl.textContent = msg;
  toastEl.className = `show ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = ""; }, 3000);
}

// ── API helpers ───────────────────────────────────────────────────────────────
const BASE = "https://tavusapi.com";

async function tavusFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as any).message ?? (err as any).error ?? JSON.stringify(err);
    console.error(`Tavus API ${res.status} on ${options.method ?? "GET"} ${path}:`, err);
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ── Load / connect ────────────────────────────────────────────────────────────
btnLoad.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) { toast("Enter your Tavus API key first.", "error"); return; }
  apiKey = key;
  localStorage.setItem(LS_KEY, key);
  btnLoad.disabled = true;
  apiStatus.className = "";
  apiStatus.textContent = "Connecting…";

  try {
    await loadReplicas();
    await loadPersonas();
    await loadDocuments();
    apiStatus.textContent = "Connected";
    apiStatus.className = "ok";
    btnRefreshReplicas.disabled = false;
    btnRefreshPersonas.disabled = false;
    btnRefreshDocs.disabled = false;
    btnNewPersona.disabled = false;
    toast("Loaded successfully.", "ok");
  } catch (e) {
    apiStatus.textContent = "Connection failed";
    apiStatus.className = "error";
    toast((e as Error).message, "error");
  } finally {
    btnLoad.disabled = false;
  }
});

btnRefreshReplicas.addEventListener("click", () => loadReplicas().catch((e) => toast(e.message, "error")));
btnRefreshPersonas.addEventListener("click", () => loadPersonas().catch((e) => toast(e.message, "error")));
btnRefreshDocs.addEventListener("click",     () => loadDocuments().catch((e) => toast(e.message, "error")));

btnNewPersona.addEventListener("click", () => {
  createPersonaForm.style.display = "flex";
  btnNewPersona.style.display = "none";
  newPersonaName.focus();
});
btnCancelPersona.addEventListener("click", () => {
  createPersonaForm.style.display = "none";
  btnNewPersona.style.display = "inline-block";
  newPersonaName.value = "";
  newPersonaPrompt.value = "";
});
btnCreatePersona.addEventListener("click", async () => {
  const name   = newPersonaName.value.trim();
  const prompt = newPersonaPrompt.value.trim();
  if (!name) { toast("Persona name is required.", "error"); return; }

  btnCreatePersona.disabled = true;
  btnCreatePersona.textContent = "Creating…";
  try {
    await tavusFetch("/v2/personas", {
      method: "POST",
      body: JSON.stringify({
        persona_name: name,
        ...(prompt ? { system_prompt: prompt } : {}),
      }),
    });
    toast(`Persona "${name}" created.`, "ok");
    createPersonaForm.style.display = "none";
    btnNewPersona.style.display = "inline-block";
    newPersonaName.value = "";
    newPersonaPrompt.value = "";
    await loadPersonas();
    await loadDocuments();
  } catch (e) {
    toast((e as Error).message, "error");
  } finally {
    btnCreatePersona.disabled = false;
    btnCreatePersona.textContent = "Create Persona";
  }
});

// ── Replicas ──────────────────────────────────────────────────────────────────
async function loadReplicas() {
  replicasBody.innerHTML = `<div class="empty"><span class="spinner"></span>Loading…</div>`;
  const data = await tavusFetch<{ data: Replica[] }>("/v2/replicas");
  const replicas = data.data ?? [];

  if (!replicas.length) {
    replicasBody.innerHTML = `<div class="empty">No replicas found.<br>Create one at platform.tavus.io</div>`;
    return;
  }

  replicasBody.innerHTML = "";
  replicas.forEach((r) => {
    const card = document.createElement("div");
    card.className = "card" + (r.replica_id === selectedReplicaId ? " selected" : "");
    card.dataset.id = r.replica_id;
    const statusBadge = r.status === "ready"
      ? `<span class="badge badge-green">${r.status}</span>`
      : `<span class="badge badge-amber">${r.status ?? "unknown"}</span>`;
    card.innerHTML = `
      <div class="card-name">${r.replica_name || "Unnamed"}</div>
      <div class="card-id">${r.replica_id}</div>
      <div class="card-badges">${statusBadge}</div>`;
    card.addEventListener("click", () => selectReplica(r.replica_id, r.replica_name, card));
    replicasBody.appendChild(card);
  });
}

function selectReplica(id: string, name: string, card: HTMLElement) {
  replicasBody.querySelectorAll(".card").forEach((c) => c.classList.remove("selected"));
  card.classList.add("selected");
  selectedReplicaId = id;
  chipReplica.textContent = name || id;
  chipReplica.className = "chip-val";
  updateLaunchBtn();
}

// ── Personas ──────────────────────────────────────────────────────────────────
async function loadPersonas() {
  personasBody.innerHTML = `<div class="empty"><span class="spinner"></span>Loading…</div>`;
  const data = await tavusFetch<{ data: Persona[] }>("/v2/personas");
  const list = data.data ?? [];

  if (!list.length) {
    allPersonas = [];
    personasBody.innerHTML = `<div class="empty">No personas found.<br>Create one with the + New button above.</div>`;
    return;
  }

  // Fetch each persona individually to get accurate document_ids (list endpoint omits them)
  allPersonas = await Promise.all(
    list.map(async (p) => {
      try {
        const res = await tavusFetch<{ data: Persona[] }>(`/v2/personas/${p.persona_id}`);
        return res.data?.[0] ?? p;
      } catch {
        return p;
      }
    })
  );

  personasBody.innerHTML = "";
  allPersonas.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card" + (p.persona_id === selectedPersonaId ? " selected" : "");
    card.dataset.id = p.persona_id;
    const docCount = p.document_ids?.length ?? 0;
    const docBadge = docCount
      ? `<span class="badge badge-accent">${docCount} doc${docCount > 1 ? "s" : ""}</span>`
      : `<span class="badge badge-muted">no docs</span>`;
    card.innerHTML = `
      <div class="card-name">${p.persona_name || "Unnamed"}</div>
      <div class="card-id">${p.persona_id}</div>
      <div class="card-badges">${docBadge}</div>`;
    card.addEventListener("click", () => selectPersona(p.persona_id, p.persona_name, card));
    personasBody.appendChild(card);
  });
}

function selectPersona(id: string, name: string, card: HTMLElement) {
  personasBody.querySelectorAll(".card").forEach((c) => c.classList.remove("selected"));
  card.classList.add("selected");
  selectedPersonaId = id;
  chipPersona.textContent = name || id;
  chipPersona.className = "chip-val";
  updateLaunchBtn();
}

// ── Knowledge Base ────────────────────────────────────────────────────────────
async function loadDocuments() {
  docsBody.innerHTML = `<div class="empty"><span class="spinner"></span>Loading…</div>`;
  const data = await tavusFetch<{ data: TavusDocument[] }>("/v2/documents");
  const docs = data.data ?? [];

  docsBody.innerHTML = "";

  // Add document row
  const addRow = document.createElement("div");
  addRow.className = "doc-add-row";
  addRow.innerHTML = `
    <input id="doc-url-input" type="text" placeholder="https://… URL or paste text" />
    <input id="doc-name-input" type="text" placeholder="Name" style="max-width:110px" />
    <button class="btn btn-accent" id="btn-add-doc">+ Add</button>`;
  docsBody.appendChild(addRow);

  document.getElementById("btn-add-doc")!.addEventListener("click", addDocument);

  if (!docs.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No documents yet. Add a URL above.";
    docsBody.appendChild(empty);
    return;
  }

  docs.forEach((d) => {
    const card = document.createElement("div");
    card.className = "card doc-card";
    card.dataset.docId = d.document_id;

    const tagBadges = (d.tags ?? []).map((t) => `<span class="badge badge-muted">${t}</span>`).join("");
    const statusBadge = d.status === "ready"
      ? `<span class="badge badge-green">${d.status}</span>`
      : `<span class="badge badge-amber">${d.status ?? "processing"}</span>`;

    // Build persona selector for attaching
    const personaOptions = allPersonas.map(
      (p) => `<option value="${p.persona_id}">${p.persona_name || p.persona_id}</option>`
    ).join("");

    card.innerHTML = `
      <div class="card-name">${d.document_name || "Untitled"}</div>
      <div class="card-id">${d.document_id}</div>
      <div class="card-badges">${statusBadge}${tagBadges}</div>
      <div class="attach-row">
        <select class="persona-attach-select">
          <option value="">Attach to persona…</option>
          ${personaOptions}
        </select>
        <button class="btn btn-accent btn-attach" data-doc-id="${d.document_id}">Attach</button>
        <button class="btn btn-ghost btn-delete-doc" data-doc-id="${d.document_id}" style="color:#ef4444">Delete</button>
      </div>`;

    card.querySelector(".btn-attach")!.addEventListener("click", () => {
      const sel = card.querySelector<HTMLSelectElement>(".persona-attach-select")!;
      if (!sel.value) { toast("Select a persona first.", "error"); return; }
      attachDocToPersona(d.document_id, sel.value);
    });

    card.querySelector(".btn-delete-doc")!.addEventListener("click", () => deleteDocument(d.document_id));

    docsBody.appendChild(card);
  });
}

async function addDocument() {
  const urlInput  = document.getElementById("doc-url-input")!  as HTMLInputElement;
  const nameInput = document.getElementById("doc-name-input")! as HTMLInputElement;
  const url  = urlInput.value.trim();
  const name = nameInput.value.trim();
  if (!url) { toast("Enter a URL.", "error"); return; }

  const btn = document.getElementById("btn-add-doc")! as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Adding…";

  try {
    await tavusFetch("/v2/documents", {
      method: "POST",
      body: JSON.stringify({ url, document_name: name || url }),
    });
    toast("Document added.", "ok");
    urlInput.value = "";
    nameInput.value = "";
    await loadDocuments();
  } catch (e) {
    toast((e as Error).message, "error");
    btn.disabled = false;
    btn.textContent = "+ Add";
  }
}

async function deleteDocument(docId: string) {
  if (!confirm("Delete this document?")) return;
  try {
    await tavusFetch(`/v2/documents/${docId}`, { method: "DELETE" });
    toast("Document deleted.", "ok");
    await loadDocuments();
  } catch (e) {
    toast((e as Error).message, "error");
  }
}

async function attachDocToPersona(docId: string, personaId: string) {
  try {
    // Fetch current persona shape before patching — list response may omit document_ids
    const res = await tavusFetch<{ data: Persona[] }>(`/v2/personas/${personaId}`);
    const current = res.data?.[0] ?? res as unknown as Persona;
    const existingIds = current.document_ids ?? [];

    if (existingIds.includes(docId)) { toast("Already attached.", ""); return; }

    const newIds = [...existingIds, docId];
    // Use "add" when field doesn't exist yet, "replace" when it does
    const op = existingIds.length ? "replace" : "add";

    await tavusFetch(`/v2/personas/${personaId}`, {
      method: "PATCH",
      body: JSON.stringify([
        { op, path: "/document_ids", value: newIds },
      ]),
    });
    toast("Document attached to persona.", "ok");
    await loadPersonas();
    await loadDocuments();
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("400")) {
      toast("Cannot modify this persona — it may be a stock/example persona. Create your own with the + New button.", "error");
    } else {
      toast(msg, "error");
    }
  }
}

// ── Launch conversation ───────────────────────────────────────────────────────
function updateLaunchBtn() {
  btnLaunch.disabled = !(selectedReplicaId && selectedPersonaId);
}

btnLaunch.addEventListener("click", async () => {
  if (!selectedReplicaId || !selectedPersonaId) return;
  btnLaunch.disabled = true;
  btnLaunch.textContent = "Starting…";

  try {
    const body: Record<string, string> = {
      replica_id: selectedReplicaId,
      persona_id: selectedPersonaId,
    };
    const name = convNameInput.value.trim();
    if (name) body.conversation_name = name;

    const data = await tavusFetch<{ conversation_id: string; conversation_url: string }>("/v2/conversations", {
      method: "POST",
      body: JSON.stringify(body),
    });

    activeConvId     = data.conversation_id;
    activeConvApiKey = apiKey;

    convOverlayTitle.textContent = `conversation_id: ${activeConvId}`;
    convFrame.src = data.conversation_url;
    convOverlay.classList.add("visible");

    btnEnd.style.display = "inline-block";
    btnLaunch.style.display = "none";
    toast("Conversation started.", "ok");
  } catch (e) {
    toast((e as Error).message, "error");
    btnLaunch.disabled = false;
    btnLaunch.textContent = "▶ Start Conversation";
  }
});

async function endConversation() {
  if (!activeConvId) return;
  try {
    await fetch(`${BASE}/v2/conversations/${activeConvId}/end`, {
      method: "POST",
      headers: { "x-api-key": activeConvApiKey },
    });
    toast("Conversation ended.", "ok");
  } catch {
    // best-effort
  }
  activeConvId = "";
  convFrame.src = "";
  convOverlay.classList.remove("visible");
  btnEnd.style.display = "none";
  btnLaunch.style.display = "inline-block";
  btnLaunch.disabled = false;
  btnLaunch.textContent = "▶ Start Conversation";
}

btnEnd.addEventListener("click", endConversation);
btnEndOverlay.addEventListener("click", endConversation);
