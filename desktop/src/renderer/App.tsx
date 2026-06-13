import { QueryClientProvider } from "@tanstack/react-query";
import { domMax, LazyMotion } from "framer-motion";

import { queryClient } from "@/app/query-client";
import { AppRouter } from "@/app/router";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export function App() {
  return (
    <LazyMotion features={domMax}>
      <div className="contents">
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <TooltipProvider>
              <AppRouter />
            </TooltipProvider>
          </ToastProvider>
        </QueryClientProvider>
      </div>
    </LazyMotion>
  );
}
