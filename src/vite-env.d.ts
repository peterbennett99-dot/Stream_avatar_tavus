/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly LIVEAVATAR_API_KEY: string;
  readonly ELEVENLABS_API_KEY: string;
  readonly ELEVENLABS_SECRET_ID: string;
  readonly ELEVENLABS_AGENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
