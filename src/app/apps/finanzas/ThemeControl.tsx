import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const key = "financelab-theme";
const changed = "financelab-theme-change";
let preference: Theme | undefined;
function readTheme(): Theme {
  if (preference) return preference;
  try {
    const value = localStorage.getItem(key);
    if (value === "light" || value === "dark") return value;
  } catch {
    // The theme still works for this visit when browser storage is blocked.
  }
  return "system";
}
function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      preference = undefined;
      notify();
    }
  };
  window.addEventListener("storage", sync);
  window.addEventListener(changed, notify);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener(changed, notify);
  };
}
const serverTheme = (): Theme => "system";
export function useFinanceTheme() {
  return useSyncExternalStore(subscribe, readTheme, serverTheme);
}
export function ThemeControl({ theme }: { theme: Theme }) {
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <label className="fl-theme">
      <Icon size={16} aria-hidden="true" />
      <select
        aria-label="Tema de color"
        value={theme}
        onChange={(event) => {
          const next = event.target.value as Theme;
          preference = next;
          try {
            localStorage.setItem(key, next);
          } catch {
            // Keep the in-memory preference if storage is unavailable.
          }
          window.dispatchEvent(new Event(changed));
        }}
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
