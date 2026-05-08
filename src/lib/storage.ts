const PREFIX = "sayknow:"

export const storage = {
  get<T = string>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as T
      } catch {
        return raw as unknown as T
      }
    } catch {
      return null
    }
  },
  set(key: string, value: unknown) {
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value)
      localStorage.setItem(PREFIX + key, serialized)
    } catch {
      // ignore
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(PREFIX + key)
    } catch {
      // ignore
    }
  },
}
