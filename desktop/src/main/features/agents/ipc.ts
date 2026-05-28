import type {
  CreateCustomAgentInput,
  UpdateCustomAgentInput,
} from "../../../shared/agents";
import type { ChatRuntime } from "../chat/runtime";
import { tipc } from "@egoist/tipc/main";
import { listAvailableAgents } from "./availability";
import {
  createCustomAgent,
  customAgentDeleteImpact,
  deleteCustomAgentWithChats,
  listCustomAgents,
  updateCustomAgent,
} from "./repository";

const t = tipc.create();

export function createAgentIpcRouter(chatRuntime: ChatRuntime) {
  return {
    agentsCreateCustom: t.procedure
      .input<CreateCustomAgentInput>()
      .action(async ({ input }) => createCustomAgent(input)),
    agentsCustomDeleteImpact: t.procedure
      .input<string>()
      .action(async ({ input }) => customAgentDeleteImpact(input)),
    agentsDeleteCustom: t.procedure
      .input<string>()
      .action(async ({ input }) => {
        const deletedChatIds = deleteCustomAgentWithChats(input);
        for (const chatId of deletedChatIds) {
          chatRuntime.closeChatSession(chatId);
        }
        return { deletedChatIds };
      }),
    agentsListAvailable: t.procedure.action(async () => listAvailableAgents()),
    agentsListCustom: t.procedure.action(async () => listCustomAgents()),
    agentsUpdateCustom: t.procedure
      .input<UpdateCustomAgentInput>()
      .action(async ({ input }) => updateCustomAgent(input)),
  };
}
