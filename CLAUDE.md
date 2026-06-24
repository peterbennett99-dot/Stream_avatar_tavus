# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Vite + TypeScript single-page demo for HeyGen's [LiveAvatar Web SDK](https://docs.liveavatar.com). It uses **LITE mode** with the **ElevenLabs Agent Plugin** — the avatar is driven by an ElevenLabs conversational AI agent in real-time.

## Commands

```bash
make install   # install deps
make dev       # dev server (http://localhost:5173)
make build     # tsc + vite build → dist/
make preview   # serve dist/
make clean     # remove node_modules and dist
```

Or use `npm run <dev|build|preview>` directly.

## Architecture

```
index.html        # all UI markup + inline CSS
src/main.ts       # all application logic (no framework)
package.json      # deps: @heygen/liveavatar-web-sdk, vite, typescript
```

The app is intentionally framework-free — one HTML file, one TS file.

### Session flow (LITE + ElevenLabs Agent)

1. **Register secret** — (one-time, done out-of-band) `POST https://api.liveavatar.com/v1/secrets` with `secret_type: "ELEVENLABS_API_KEY"` to store your 11Labs API key; returns a `secret_id`.
2. **Token** — `POST https://api.liveavatar.com/v1/sessions/token` with `mode: "LITE"` and `elevenlabs_agent_config: { secret_id, agent_id }`. Returns `{ data: { session_token } }`. In production move this to a backend.
3. **SDK** — `new LiveAvatarSession(sessionToken, { voiceChat: true })` — `voiceChat: true` is required to capture browser mic and publish it into the LiveKit room so the ElevenLabs agent can hear the user.
4. **Start** — `session.start()` connects to LiveKit; LiveAvatar deploys a worker that talks to your ElevenLabs agent.
5. **Stream** — listen for `SessionEvent.SESSION_STREAM_READY`, then call `session.attach(videoElement)` and un-mute.
6. **Stop** — `session.stop()` disconnects and terminates server-side.

> **Note**: LITE + ElevenLabs agent does NOT use standard LITE events — it uses the FULL Mode event system (`AgentEventsEnum.*`).

### Key SDK API (`@heygen/liveavatar-web-sdk`)

| Method | Purpose | Works in LITE+ElevenLabs? |
|---|---|---|
| `session.start()` | Connect and start streaming | ✅ |
| `session.stop()` | Graceful disconnect | ✅ |
| `session.attach(el)` | Pipe video+audio into a `<video>` element | ✅ |
| `session.startListening()` | Switch avatar to listen state | ✅ |
| `session.stopListening()` | Return avatar to idle | ✅ |
| `session.interrupt()` | Stop current avatar speech | ✅ |
| `session.keepAlive()` | Ping to prevent session timeout | ✅ |
| `session.repeat(text)` | Avatar speaks text verbatim (no LLM) | ❌ needs ws_url |
| `session.message(text)` | Avatar generates LLM response to text | ❌ needs ws_url |
| `session.repeatAudio(b64)` | Avatar speaks raw PCM audio | ❌ needs ws_url |

> In LITE + ElevenLabs mode the server does not return `ws_url`, so commands routed through the WebSocket are silently dropped or throw. Only LiveKit data channel commands work.

Session events: `SESSION_STATE_CHANGED`, `SESSION_STREAM_READY`, `SESSION_DISCONNECTED`.
Agent events (transcripts, speaking state): `AgentEventsEnum.*` — `USER_SPEAK_STARTED`, `USER_TRANSCRIPTION`, `AVATAR_SPEAK_STARTED`, `AVATAR_TRANSCRIPTION`, etc.

### ElevenLabs agent requirements

- API key needs scopes: `convai_read`, `user_read`, `voices_read`
- Agent audio output must be configured as **PCM 24K** in the ElevenLabs dashboard
- Costs: 1 credit/min (LiveAvatar) + ElevenLabs agent usage billed separately
- Currently in beta

### Sandbox mode

Pass `is_sandbox: true` in the token request. Free, no credits consumed, sessions auto-terminate at ~1 minute. Only the Wayne avatar (`dd73ea75-1218-4ef3-92ce-606d5f7fbc0a`) is available in sandbox.

### Reference repo

The official SDK source and React demo live at `/home/max/workspace/github/liveavatar-web-sdk`. The core class is at `packages/js-sdk/src/LiveAvatarSession/LiveAvatarSession.ts`.
