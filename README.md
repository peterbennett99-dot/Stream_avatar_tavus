# Streaming Avatar Demo

HeyGen LiveAvatar (LITE mode) + ElevenLabs conversational AI agent demo.

## Install

```bash
make install
# or: npm install
```

## Run

```bash
make dev
# or: npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Once the session starts and the avatar delivers its intro, click **Start Listening** to activate the mic — the ElevenLabs agent will then hear you and respond.

## Other commands

```bash
make build    # production build → dist/
make preview  # serve dist/
make clean    # remove node_modules and dist
```
