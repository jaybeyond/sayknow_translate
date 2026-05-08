export const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  // Tauri 2 sets this on the global Window
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
