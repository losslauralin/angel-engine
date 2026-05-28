import type {
  AgentOption,
  AgentRuntime,
  AgentSettings,
  CreateCustomAgentInput,
  CustomAgent,
  UpdateCustomAgentInput,
} from "@shared/agents";

import type { SupportedLanguage } from "@shared/i18n/resources";
import type { DesktopThemeMode } from "@/platform/theme";
import { sanitizeAgentSettings } from "@shared/agents";
import { normalizeSupportedLanguage } from "@shared/i18n/resources";
import { create } from "zustand";
import { getApiClient } from "@/platform/api-client";
import { readDesktopThemeMode, setDesktopThemeMode } from "@/platform/theme";

const agentSettingsStorageKey = "angel-engine.agent-settings.v1";
const languageStorageKey = "angel-engine.language";
const settingsBroadcastChannel = "angel-engine.settings.v1";
const senderId = globalThis.crypto?.randomUUID?.() ?? String(Date.now());

interface SettingsBroadcastMessage {
  agentSettings: AgentSettings;
  language: SupportedLanguage;
  senderId: string;
  themeMode: DesktopThemeMode;
}

interface SettingsState {
  agentSettings: AgentSettings;
  availableAgentOptions: AgentOption[];
  customAgents: CustomAgent[];
  createCustomAgent: (input: CreateCustomAgentInput) => Promise<CustomAgent>;
  deleteCustomAgent: (runtime: AgentRuntime) => Promise<void>;
  deleteCustomAgentImpact: (
    runtime: AgentRuntime,
  ) => Promise<{ chatCount: number }>;
  language: SupportedLanguage;
  refreshAvailableAgentOptions: () => Promise<void>;
  setAgentEnabled: (runtime: AgentRuntime, enabled: boolean) => void;
  setAgentSettings: (
    updater: (settings: AgentSettings) => AgentSettings,
  ) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setThemeMode: (themeMode: DesktopThemeMode) => void;
  themeMode: DesktopThemeMode;
  updateCustomAgent: (input: UpdateCustomAgentInput) => Promise<CustomAgent>;
}

const broadcastChannel = createBroadcastChannel();

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  agentSettings: readAgentSettings(),
  availableAgentOptions: [],
  customAgents: [],
  createCustomAgent: async (input) => {
    const agent = await getApiClient().agents.createCustom(input);
    updateSettingsState(set, get, (current) => ({
      agentSettings: sanitizeAgentSettings({
        ...current.agentSettings,
        enabledRuntimes: [...current.agentSettings.enabledRuntimes, agent.id],
        lastRuntime: agent.id,
      }),
      customAgents: [...current.customAgents, agent],
    }));
    await get().refreshAvailableAgentOptions();
    return agent;
  },
  deleteCustomAgent: async (runtime) => {
    await getApiClient().agents.deleteCustom(runtime);
    updateSettingsState(set, get, (current) => ({
      agentSettings: sanitizeAgentSettings({
        ...current.agentSettings,
        enabledRuntimes: current.agentSettings.enabledRuntimes.filter(
          (item) => item !== runtime,
        ),
        lastRuntime:
          current.agentSettings.lastRuntime === runtime
            ? undefined
            : current.agentSettings.lastRuntime,
        runtimePreferences: Object.fromEntries(
          Object.entries(current.agentSettings.runtimePreferences).filter(
            ([key]) => key !== runtime,
          ),
        ),
      }),
      customAgents: current.customAgents.filter(
        (agent) => agent.id !== runtime,
      ),
    }));
    await get().refreshAvailableAgentOptions();
  },
  deleteCustomAgentImpact: async (runtime) =>
    getApiClient().agents.deleteCustomImpact(runtime),
  language: readLanguage(),
  refreshAvailableAgentOptions: async () => {
    const [availableAgentOptions, customAgents] = await Promise.all([
      getApiClient().agents.listAvailable(),
      getApiClient().agents.listCustom(),
    ]);
    set({ availableAgentOptions, customAgents });
  },
  setAgentEnabled: (runtime, enabled) => {
    updateSettingsState(set, get, (current) => {
      const enabledRuntimes = new Set(current.agentSettings.enabledRuntimes);
      if (enabled) {
        enabledRuntimes.add(runtime);
      } else {
        enabledRuntimes.delete(runtime);
      }

      return {
        agentSettings: sanitizeAgentSettings({
          ...current.agentSettings,
          enabledRuntimes: [...enabledRuntimes],
        }),
      };
    });
  },
  setAgentSettings: (updater) => {
    updateSettingsState(set, get, (current) => ({
      agentSettings: sanitizeAgentSettings(updater(current.agentSettings)),
    }));
  },
  setLanguage: (language) => {
    updateSettingsState(set, get, (current) => {
      const normalizedLanguage = normalizeSupportedLanguage(language);
      return current.language === normalizedLanguage
        ? {}
        : { language: normalizedLanguage };
    });
  },
  setThemeMode: (themeMode) => {
    updateSettingsState(set, get, (current) =>
      current.themeMode === themeMode ? {} : { themeMode },
    );
  },
  themeMode: readDesktopThemeMode(),
  updateCustomAgent: async (input) => {
    const agent = await getApiClient().agents.updateCustom(input);
    set((current) => ({
      customAgents: current.customAgents.map((item) =>
        item.id === agent.id ? agent : item,
      ),
    }));
    await get().refreshAvailableAgentOptions();
    return agent;
  },
}));

void useSettingsStore
  .getState()
  .refreshAvailableAgentOptions()
  .catch(() => {});

broadcastChannel?.addEventListener("message", (event) => {
  const message = readBroadcastMessage(event.data);
  if (!message || message.senderId === senderId) return;

  applySettingsSideEffects(message);
  useSettingsStore.setState({
    agentSettings: message.agentSettings,
    language: message.language,
    themeMode: message.themeMode,
  });
});

function updateSettingsState(
  set: (
    partial:
      | Partial<SettingsState>
      | ((state: SettingsState) => Partial<SettingsState>),
  ) => void,
  get: () => SettingsState,
  updater: (state: SettingsState) => Partial<SettingsState>,
) {
  const nextPartial = updater(get());
  if (Object.keys(nextPartial).length === 0) return;

  set(nextPartial);
  const nextState = get();
  const message = settingsBroadcastMessage(nextState);
  applySettingsSideEffects(message);
  broadcastChannel?.postMessage(message);
}

function settingsBroadcastMessage(
  state: Pick<SettingsState, "agentSettings" | "language" | "themeMode">,
): SettingsBroadcastMessage {
  return {
    agentSettings: state.agentSettings,
    language: state.language,
    senderId,
    themeMode: state.themeMode,
  };
}

function applySettingsSideEffects(message: SettingsBroadcastMessage) {
  writeAgentSettings(message.agentSettings);
  writeLanguage(message.language);
  setDesktopThemeMode(message.themeMode);
}

function readBroadcastMessage(value: unknown): SettingsBroadcastMessage | null {
  if (value === null || typeof value !== "object") return null;
  const input = value as Partial<SettingsBroadcastMessage>;
  if (typeof input.senderId !== "string") return null;

  return {
    agentSettings: sanitizeAgentSettings(input.agentSettings),
    language: normalizeSupportedLanguage(input.language),
    senderId: input.senderId,
    themeMode: sanitizeThemeMode(input.themeMode),
  };
}

function readAgentSettings() {
  try {
    const raw = window.localStorage.getItem(agentSettingsStorageKey);
    const settings = sanitizeAgentSettings(
      raw !== null ? JSON.parse(raw) : undefined,
    );
    writeAgentSettings(settings);
    return settings;
  } catch {
    const settings = sanitizeAgentSettings(undefined);
    writeAgentSettings(settings);
    return settings;
  }
}

function writeAgentSettings(settings: AgentSettings) {
  window.localStorage.setItem(
    agentSettingsStorageKey,
    JSON.stringify(settings),
  );
}

function readLanguage() {
  try {
    return normalizeSupportedLanguage(
      window.localStorage.getItem(languageStorageKey) ??
        window.navigator.language,
    );
  } catch {
    return normalizeSupportedLanguage(window.navigator.language);
  }
}

function writeLanguage(language: SupportedLanguage) {
  window.localStorage.setItem(languageStorageKey, language);
}

function sanitizeThemeMode(value: unknown): DesktopThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

function createBroadcastChannel() {
  try {
    return new BroadcastChannel(settingsBroadcastChannel);
  } catch {
    return null;
  }
}
