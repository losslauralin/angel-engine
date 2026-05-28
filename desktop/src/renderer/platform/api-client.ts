import type {
  CreateCustomAgentInput,
  UpdateCustomAgentInput,
} from "@shared/agents";
import type {
  ChatCreateInput,
  ChatPrewarmInput,
  ChatRenameInput,
  ChatRuntimeConfigInput,
  ChatSetModeInput,
  ChatSetPermissionModeInput,
  ChatSetRuntimeInput,
  ProjectFileSearchInput,
} from "@shared/chat";
import type { CreateProjectInput } from "@shared/projects";
import { ipc } from "@/platform/ipc";

interface AgentsApiClient {
  createCustom: (
    input: CreateCustomAgentInput,
  ) => ReturnType<typeof ipc.agentsCreateCustom>;
  deleteCustom: (agentId: string) => ReturnType<typeof ipc.agentsDeleteCustom>;
  deleteCustomImpact: (
    agentId: string,
  ) => ReturnType<typeof ipc.agentsCustomDeleteImpact>;
  listAvailable: () => ReturnType<typeof ipc.agentsListAvailable>;
  listCustom: () => ReturnType<typeof ipc.agentsListCustom>;
  updateCustom: (
    input: UpdateCustomAgentInput,
  ) => ReturnType<typeof ipc.agentsUpdateCustom>;
}

interface ChatApiClient {
  archive: (chatId: string) => ReturnType<typeof ipc.chatsArchive>;
  create: (input?: ChatCreateInput) => ReturnType<typeof ipc.chatsCreate>;
  deleteAll: () => ReturnType<typeof ipc.chatsDeleteAll>;
  inspectConfig: (
    input?: ChatRuntimeConfigInput,
  ) => ReturnType<typeof ipc.chatsRuntimeConfig>;
  list: () => ReturnType<typeof ipc.chatsList>;
  load: (chatId: string) => ReturnType<typeof ipc.chatsLoad>;
  prewarm: (input?: ChatPrewarmInput) => ReturnType<typeof ipc.chatsPrewarm>;
  rename: (input: ChatRenameInput) => ReturnType<typeof ipc.chatsRename>;
  setMode: (input: ChatSetModeInput) => ReturnType<typeof ipc.chatsSetMode>;
  setPermissionMode: (
    input: ChatSetPermissionModeInput,
  ) => ReturnType<typeof ipc.chatsSetPermissionMode>;
  setRuntime: (
    input: ChatSetRuntimeInput,
  ) => ReturnType<typeof ipc.chatsSetRuntime>;
  showContextMenu: (
    chatId: string,
  ) => ReturnType<typeof ipc.chatsShowContextMenu>;
}

interface ProjectsApiClient {
  chooseDirectory: () => ReturnType<typeof ipc.projectsChooseDirectory>;
  create: (input: CreateProjectInput) => ReturnType<typeof ipc.projectsCreate>;
  list: () => ReturnType<typeof ipc.projectsList>;
  searchFiles: (
    input: ProjectFileSearchInput,
  ) => ReturnType<typeof ipc.projectsSearchFiles>;
  showContextMenu: (
    projectId: string,
  ) => ReturnType<typeof ipc.projectsShowContextMenu>;
}

export interface ApiClient {
  agents: AgentsApiClient;
  chats: ChatApiClient;
  projects: ProjectsApiClient;
}

export function createApiClient(): ApiClient {
  return {
    agents: {
      createCustom: async (input: CreateCustomAgentInput) =>
        ipc.agentsCreateCustom(input),
      deleteCustom: async (agentId: string) => ipc.agentsDeleteCustom(agentId),
      deleteCustomImpact: async (agentId: string) =>
        ipc.agentsCustomDeleteImpact(agentId),
      listAvailable: async () => ipc.agentsListAvailable(),
      listCustom: async () => ipc.agentsListCustom(),
      updateCustom: async (input: UpdateCustomAgentInput) =>
        ipc.agentsUpdateCustom(input),
    },
    chats: {
      archive: async (chatId: string) => ipc.chatsArchive(chatId),
      create: async (input: ChatCreateInput = {}) => ipc.chatsCreate(input),
      deleteAll: async () => ipc.chatsDeleteAll(),
      inspectConfig: async (input: ChatRuntimeConfigInput = {}) =>
        ipc.chatsRuntimeConfig(input),
      list: async () => ipc.chatsList(),
      load: async (chatId: string) => ipc.chatsLoad(chatId),
      prewarm: async (input: ChatPrewarmInput = {}) => ipc.chatsPrewarm(input),
      rename: async (input: ChatRenameInput) => ipc.chatsRename(input),
      setMode: async (input: ChatSetModeInput) => ipc.chatsSetMode(input),
      setPermissionMode: async (input: ChatSetPermissionModeInput) =>
        ipc.chatsSetPermissionMode(input),
      setRuntime: async (input: ChatSetRuntimeInput) =>
        ipc.chatsSetRuntime(input),
      showContextMenu: async (chatId: string) =>
        ipc.chatsShowContextMenu(chatId),
    },
    projects: {
      chooseDirectory: async () => ipc.projectsChooseDirectory(),
      create: async (input: CreateProjectInput) => ipc.projectsCreate(input),
      list: async () => ipc.projectsList(),
      searchFiles: async (input: ProjectFileSearchInput) =>
        ipc.projectsSearchFiles(input),
      showContextMenu: async (projectId: string) =>
        ipc.projectsShowContextMenu(projectId),
    },
  };
}

let apiClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  apiClient ??= createApiClient();
  return apiClient;
}
