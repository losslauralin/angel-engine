import type { AgentOption, AgentRuntime } from "../../../shared/agents";

import { createRequire } from "node:module";

import { AGENT_OPTIONS } from "../../../shared/agents";

type Which = (
  command: string,
  options: { nothrow: true },
) => Promise<string | null>;

const require = createRequire(import.meta.url);
const which = require("which") as Which;

const runtimeCommands: Record<AgentRuntime, () => string> = {
  claude: () =>
    process.env.CLAUDE_CODE_PATH ?? process.env.CLAUDE_PATH ?? "claude",
  cline: () => "cline",
  codex: () => "codex",
  copilot: () => "copilot",
  cursor: () => "agent",
  gemini: () => "gemini",
  kimi: () => "kimi",
  opencode: () => "opencode",
  qoder: () => "qodercli",
};

export async function listAvailableAgents(): Promise<AgentOption[]> {
  const availability = await Promise.all(
    AGENT_OPTIONS.map(async (agent) => ({
      agent,
      available: await commandExists(runtimeCommands[agent.id]()),
    })),
  );

  return availability.flatMap(({ agent, available }) =>
    available ? [agent] : [],
  );
}

async function commandExists(command: string): Promise<boolean> {
  return (await which(command, { nothrow: true })) !== null;
}
