import { useState, useCallback } from "react";

export interface AoaiSettings {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

const STORAGE_KEY = "aoai-settings";

const DEFAULT_SETTINGS: AoaiSettings = {
  endpoint: "",
  apiKey: "",
  deployment: "gpt-4o",
  apiVersion: "2024-12-01-preview",
};

function loadSettings(): AoaiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AoaiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useAoaiSettings() {
  const [settings, setSettingsState] = useState<AoaiSettings>(loadSettings);

  const updateSettings = useCallback((partial: Partial<AoaiSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const isConfigured = Boolean(settings.endpoint && settings.apiKey);

  return { settings, updateSettings, isConfigured };
}
