/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_GIT_COMMIT: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
