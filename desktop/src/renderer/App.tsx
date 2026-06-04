import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryClient } from "@/app/query-client";
import { AppRouter } from "@/app/router";
import { useWorkspaceUiStore } from "@/app/workspace/workspace-ui-store";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export function App() {
  const workspaceMode = useWorkspaceUiStore((state) => state.workspaceMode);

  useEffect(() => {
    document.documentElement.dataset.workspaceMode = workspaceMode;
  }, [workspaceMode]);

  return (
    <div className="contents">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TooltipProvider>
            <AppRouter />
          </TooltipProvider>
        </ToastProvider>
      </QueryClientProvider>
    </div>
  );
}
