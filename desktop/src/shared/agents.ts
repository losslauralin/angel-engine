import { type as arkType } from "arktype";

export type AgentRuntime =
  | "codex"
  | "kimi"
  | "opencode"
  | "qoder"
  | "copilot"
  | "gemini"
  | "cursor"
  | "cline"
  | "claude";

export interface AgentOption {
  description: string;
  id: AgentRuntime;
  label: string;
}

export interface AgentValueOption {
  description?: string;
  label: string;
  value: string;
}

export interface AgentRuntimePreference {
  explicit?: boolean;
  mode?: string;
  model?: string;
  permissionMode?: string;
  reasoningEffort?: string;
}

export interface AgentSettings {
  enabledRuntimes: AgentRuntime[];
  lastRuntime?: AgentRuntime;
  runtimePreferences: Partial<Record<AgentRuntime, AgentRuntimePreference>>;
}

export const AGENT_OPTIONS: AgentOption[] = [
  {
    description: "Codex app runtime with planning mode and effort controls.",
    id: "codex",
    label: "Codex",
  },
  {
    description: "Kimi runtime for Moonshot-based coding sessions.",
    id: "kimi",
    label: "Kimi",
  },
  {
    description: "OpenCode runtime for local OpenCode agent sessions.",
    id: "opencode",
    label: "OpenCode",
  },
  {
    description: "Qoder CLI through its ACP server.",
    id: "qoder",
    label: "Qoder",
  },
  {
    description: "GitHub Copilot CLI through its ACP server.",
    id: "copilot",
    label: "GitHub Copilot",
  },
  {
    description: "Gemini CLI through its ACP server.",
    id: "gemini",
    label: "Gemini",
  },
  {
    description: "Cursor CLI through its ACP server.",
    id: "cursor",
    label: "Cursor",
  },
  {
    description: "Cline CLI through its ACP server.",
    id: "cline",
    label: "Cline",
  },
  {
    description: "Claude Code runtime through the Claude Agent SDK.",
    id: "claude",
    label: "Claude Code",
  },
];

const agentRuntime = arkType(
  "'codex' | 'kimi' | 'opencode' | 'qoder' | 'copilot' | 'gemini' | 'cursor' | 'cline' | 'claude'",
);

const DEFAULT_AGENT_RUNTIME: AgentRuntime = "codex";

export function isAgentRuntime(value: unknown): value is AgentRuntime {
  return !(agentRuntime(value) instanceof arkType.errors);
}

export function getEnabledAgentOptions(
  settings: AgentSettings,
  availableAgents: AgentOption[] = AGENT_OPTIONS,
): AgentOption[] {
  const enabled = new Set(settings.enabledRuntimes);
  return availableAgents.filter((agent) => enabled.has(agent.id));
}

export function resolveEnabledAgentRuntime(
  settings: AgentSettings,
  runtime?: AgentRuntime,
  availableAgents: AgentOption[] = AGENT_OPTIONS,
): AgentRuntime {
  const available = new Set(availableAgents.map((agent) => agent.id));
  const enabledRuntimes = settings.enabledRuntimes.filter((enabledRuntime) =>
    available.has(enabledRuntime),
  );

  if (runtime && enabledRuntimes.includes(runtime)) {
    return runtime;
  }

  if (settings.lastRuntime && enabledRuntimes.includes(settings.lastRuntime)) {
    return settings.lastRuntime;
  }

  return enabledRuntimes[0] ?? settings.enabledRuntimes[0];
}

export function sanitizeAgentRuntimePreference(
  value: unknown,
): AgentRuntimePreference {
  if (value === null || typeof value !== "object") return {};
  const input = value as Partial<AgentRuntimePreference>;
  const preference: AgentRuntimePreference = {};
  const model = sanitizePreferenceValue(input.model);
  const reasoningEffort = sanitizePreferenceValue(input.reasoningEffort);
  const mode = sanitizePreferenceValue(input.mode);
  const permissionMode = sanitizePreferenceValue(input.permissionMode);

  if (model !== undefined) preference.model = model;
  if (reasoningEffort !== undefined)
    preference.reasoningEffort = reasoningEffort;
  if (mode !== undefined) preference.mode = mode;
  if (permissionMode !== undefined) preference.permissionMode = permissionMode;
  if (input.explicit === true && Object.keys(preference).length > 0) {
    preference.explicit = true;
  }

  return preference;
}

export function sanitizeAgentSettings(value: unknown): AgentSettings {
  const settings =
    value !== null && typeof value === "object"
      ? (value as Partial<AgentSettings>)
      : {};
  const legacySettings =
    value !== null && typeof value === "object"
      ? (value as Partial<{ defaultRuntime: unknown }>)
      : {};
  const parsedLastRuntime = agentRuntime(settings.lastRuntime);
  const parsedLegacyDefault = agentRuntime(legacySettings.defaultRuntime);
  const fallbackRuntime =
    parsedLastRuntime instanceof arkType.errors
      ? parsedLegacyDefault instanceof arkType.errors
        ? DEFAULT_AGENT_RUNTIME
        : parsedLegacyDefault
      : parsedLastRuntime;
  const enabledRuntimes = sanitizeEnabledRuntimes(
    settings.enabledRuntimes,
    fallbackRuntime,
  );
  const lastRuntime = enabledRuntimes.includes(fallbackRuntime)
    ? fallbackRuntime
    : enabledRuntimes[0];

  return {
    enabledRuntimes,
    lastRuntime,
    runtimePreferences: sanitizeRuntimePreferences(settings.runtimePreferences),
  };
}

export function rememberAgentRuntimePreference(
  settings: AgentSettings,
  runtime: AgentRuntime,
  preference?: AgentRuntimePreference,
): AgentSettings {
  const runtimePreferences = { ...settings.runtimePreferences };
  if (preference) {
    runtimePreferences[runtime] = {
      ...preference,
      explicit: true,
    };
  } else {
    delete runtimePreferences[runtime];
  }

  return sanitizeAgentSettings({
    ...settings,
    lastRuntime: runtime,
    runtimePreferences,
  });
}

function sanitizeEnabledRuntimes(
  value: unknown,
  fallbackRuntime: AgentRuntime,
): AgentRuntime[] {
  if (!Array.isArray(value)) {
    return AGENT_OPTIONS.map((agent) => agent.id);
  }

  const parsedRuntimes = new Set<AgentRuntime>();
  for (const item of value) {
    const parsed = agentRuntime(item);
    if (!(parsed instanceof arkType.errors)) {
      parsedRuntimes.add(parsed);
    }
  }

  const enabledRuntimes = AGENT_OPTIONS.flatMap((agent) =>
    parsedRuntimes.has(agent.id) ? [agent.id] : [],
  );

  return enabledRuntimes.length > 0 ? enabledRuntimes : [fallbackRuntime];
}

function sanitizeRuntimePreferences(
  value: unknown,
): AgentSettings["runtimePreferences"] {
  if (value === null || typeof value !== "object") return {};
  const input = value as Partial<
    Record<AgentRuntime, Partial<AgentRuntimePreference>>
  >;
  const preferences: AgentSettings["runtimePreferences"] = {};

  for (const agent of AGENT_OPTIONS) {
    const preference = sanitizeAgentRuntimePreference(input[agent.id]);
    if (preference.explicit === true) {
      preferences[agent.id] = preference;
    }
  }

  return preferences;
}

function sanitizePreferenceValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
