/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_BASE_PATH: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
