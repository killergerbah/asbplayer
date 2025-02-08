/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BUILD_TARGET: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
