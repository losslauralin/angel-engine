import { use } from "react";

import { ChatRuntimeActionsContext } from "@/features/chat/runtime/chat-runtime-actions-context-value";

export function useChatRuntimeActions() {
  const value = use(ChatRuntimeActionsContext);
  if (!value) {
    throw new Error(
      "useChatRuntimeActions must be used inside ChatRuntimeActionsProvider.",
    );
  }
  return value;
}
