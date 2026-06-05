import type { AgentRuntime } from "@shared/agents";
import type {
  Chat,
  ChatCreationLocation,
  ChatRuntimeConfig,
} from "@shared/chat";
import type { Project } from "@shared/projects";
import type { ReactNode } from "react";
import type {
  ChatRunOrigin,
  ChatMessagesUpdateHandler,
  ChatUpdateHandler,
} from "./workspace-thread-types";
import type { ChatOptionsContextValue } from "@/features/chat/runtime/chat-options-context";
import { DraftProjectSelect } from "@/app/workspace/draft-project-select";
import { AssistantThread } from "@/features/chat/components/assistant-thread";
import { AppRuntimeProvider } from "@/features/chat/runtime/app-runtime-provider";
import { ChatOptionsProvider } from "@/features/chat/runtime/chat-options-context";
import { EMPTY_MESSAGES } from "./workspace-thread-types";

interface DraftChatThreadProps {
  chatOptions: ChatOptionsContextValue;
  creationLocation?: ChatCreationLocation;
  creationLocationAccessory?: ReactNode;
  model?: string;
  mode?: string;
  onChatCreated: ChatUpdateHandler;
  onChatMessagesUpdated: ChatMessagesUpdateHandler;
  onChatUpdated: ChatUpdateHandler;
  onBeforeSubmit?: () => boolean | Promise<boolean>;
  onCreateProject: () => Project | undefined | Promise<Project | undefined>;
  onProjectChange: (projectId: string | null) => void;
  permissionMode?: string;
  prewarmId?: string;
  projectId?: string;
  projectName?: string;
  projectPath?: string;
  projects: Project[];
  reasoningEffort?: string;
  runOrigin: ChatRunOrigin;
  runtime: AgentRuntime;
  runtimeConfig?: ChatRuntimeConfig;
  slotKey: string;
}

export function DraftChatThread({
  chatOptions,
  creationLocation,
  creationLocationAccessory,
  model,
  mode,
  onChatCreated,
  onChatMessagesUpdated,
  onChatUpdated,
  onBeforeSubmit,
  onCreateProject,
  onProjectChange,
  permissionMode,
  prewarmId,
  projectId,
  projectName,
  projectPath,
  projects,
  reasoningEffort,
  runOrigin,
  runtime,
  runtimeConfig,
  slotKey,
}: DraftChatThreadProps) {
  const handleChatCreated = (chat: Chat) => {
    onChatCreated(chat, undefined, undefined, runOrigin);
  };
  const handleChatUpdated: ChatUpdateHandler = (chat, messages, config) => {
    onChatUpdated(chat, messages, config, runOrigin);
  };

  return (
    <ChatOptionsProvider value={chatOptions}>
      <AppRuntimeProvider
        historyMessages={EMPTY_MESSAGES}
        historyRevision={0}
        creationLocation={creationLocation}
        model={model}
        mode={mode}
        onChatCreated={handleChatCreated}
        onChatMessagesUpdated={onChatMessagesUpdated}
        onChatUpdated={handleChatUpdated}
        prewarmId={prewarmId}
        projectId={projectId ?? null}
        projectPath={projectPath}
        permissionMode={permissionMode}
        reasoningEffort={reasoningEffort}
        runtime={runtime}
        runtimeConfig={runtimeConfig}
        slotKey={slotKey}
      >
        <AssistantThread
          composerFloatingAccessory={
            <div className="flex items-center gap-1.5">
              <DraftProjectSelect
                onCreateProject={onCreateProject}
                onProjectChange={onProjectChange}
                projects={projects}
                selectedProjectId={projectId}
              />
              {creationLocationAccessory}
            </div>
          }
          onBeforeSubmit={onBeforeSubmit}
          projectName={projectName}
        />
      </AppRuntimeProvider>
    </ChatOptionsProvider>
  );
}
