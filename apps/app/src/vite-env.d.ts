/// <reference types="vite/client" />

interface IImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_TITLE?: string;
  readonly VITE_ENABLE_DEVTOOLS?: string;
  readonly VITE_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  readonly VITE_PROXY_TARGET?: string;
  readonly MODE?: 'development' | 'staging' | 'production';
}

interface IImportMeta {
  readonly env: IImportMetaEnv;
}
