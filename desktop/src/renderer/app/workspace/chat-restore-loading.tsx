import { useTranslation } from "react-i18next";

import { workspaceContentColumnClass } from "@/features/chat/components/thread-styles";

export function ChatRestoreLoading() {
  const { t } = useTranslation();
  const restoringLabel = t("thread.restoring");

  return (
    <div
      aria-label={restoringLabel}
      className="
        flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden
        bg-background text-foreground
      "
      role="status"
    >
      <div
        className={`
          ${workspaceContentColumnClass}
          flex justify-center
        `}
      >
        <svg
          aria-hidden="true"
          className="chat-restore-mark h-24 w-64 max-w-full"
          fill="none"
          viewBox="0 0 300 112"
        >
          <text
            className="chat-restore-signature"
            dominantBaseline="middle"
            textAnchor="middle"
            x="150"
            y="58"
          >
            {/* This text is part of the loading animation mark, not UI copy. */}
            loading
          </text>
        </svg>
      </div>
      <span className="sr-only">{restoringLabel}</span>
    </div>
  );
}
