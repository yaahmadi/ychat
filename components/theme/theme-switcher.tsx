"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useYchatTheme, type YchatTheme } from "@/components/theme/ychat-theme-provider";

const options: Array<{ value: YchatTheme; label: string; description: string; icon: typeof Monitor }> = [
  { value: "system", label: "System", description: "Follow iPhone / iPad appearance", icon: Monitor },
  { value: "light", label: "Light", description: "Bright premium interface", icon: Sun },
  { value: "dark", label: "Dark", description: "Deep navy interface", icon: Moon },
];

export function ThemeSwitcher() {
  const { theme } = useYchatTheme();

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Appearance">
      {options.map(({ value, label, description, icon: Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => {
              const event = new CustomEvent("ychat:set-theme", { detail: value });
              window.dispatchEvent(event);
            }}
            className={selected ? "ychat-theme-option ychat-theme-option-active" : "ychat-theme-option"}
            aria-pressed={selected}
            title={description}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
