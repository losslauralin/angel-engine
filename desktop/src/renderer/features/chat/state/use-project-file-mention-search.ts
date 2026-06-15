import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getErrorMessage } from "@/app/workspace/workspace-display";
import { useToast } from "@/components/ui/toast";
import { projectFileSearchQueryOptions } from "@/features/projects/api/queries";
import { useApi } from "@/platform/use-api";

interface UseProjectFileMentionSearchParams {
  enabled: boolean;
  mentionQuery: string | null;
  projectRoot: string | undefined;
}

const FILE_MENTION_SEARCH_DEBOUNCE_MS = 120;

export function mentionQueryFromDraft(text: string) {
  const match = /(?:^|\s)@([^\s@]+)$/.exec(text);
  return match ? match[1] : null;
}

export function useProjectFileMentionSearch({
  enabled,
  mentionQuery,
  projectRoot,
}: UseProjectFileMentionSearchParams) {
  const api = useApi();
  const toast = useToast();
  const { t } = useTranslation();
  const searchQuery =
    enabled &&
    projectRoot !== undefined &&
    mentionQuery !== null &&
    mentionQuery.length > 0
      ? mentionQuery
      : null;
  const debouncedSearchQuery = useDebouncedSearchQuery(
    searchQuery,
    FILE_MENTION_SEARCH_DEBOUNCE_MS,
  );
  const fileSearchQuery = useQuery({
    ...projectFileSearchQueryOptions({
      api,
      enabled:
        enabled && projectRoot !== undefined && debouncedSearchQuery !== null,
      query: debouncedSearchQuery ?? "",
      root: projectRoot ?? "",
    }),
  });

  useEffect(() => {
    if (!fileSearchQuery.isError) return;
    toast({
      description: getErrorMessage(fileSearchQuery.error),
      title: t("composer.toasts.couldNotSearchFiles"),
      variant: "destructive",
    });
  }, [
    fileSearchQuery.error,
    fileSearchQuery.errorUpdatedAt,
    fileSearchQuery.isError,
    t,
    toast,
  ]);

  if (debouncedSearchQuery === null) {
    return {
      fileResults: [],
      fileSearchLoading: false,
    };
  }

  return {
    fileResults: fileSearchQuery.data ?? [],
    fileSearchLoading:
      searchQuery !== debouncedSearchQuery || fileSearchQuery.isFetching,
  };
}

function useDebouncedSearchQuery(query: string | null, delayMs: number) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    if (query === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [delayMs, query]);

  return query === null ? null : debouncedQuery;
}
