import { tipc } from "@egoist/tipc/main";

import { listAvailableAgents } from "./availability";

const t = tipc.create();

export const agentIpcRouter = {
  agentsListAvailable: t.procedure.action(async () => listAvailableAgents()),
};
