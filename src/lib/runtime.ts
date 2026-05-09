export const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  // Tauri 2 sets this on the global Window
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)

/** Open a URL in the user's default browser (Tauri) or new tab (web fallback). */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core")
    try {
      await invoke("open_external", { url })
      return
    } catch (e) {
      console.error("open_external failed:", e)
    }
  }
  window.open(url, "_blank", "noopener,noreferrer")
}
