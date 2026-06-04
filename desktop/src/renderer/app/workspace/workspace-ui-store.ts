import { create } from "zustand";

export type WorkspaceMode = "chat" | "work";

export type SidebarChatDateGroupKey =
  | "dayBeforeYesterday"
  | "older"
  | "previousMonth"
  | "previousWeek"
  | "today"
  | "yesterday";

interface WorkspaceUiState {
  collapsedChatDateGroupKeys: Set<SidebarChatDateGroupKey>;
  expandedProjectIds: Set<string>;
  setSidebarOpen: (sidebarOpen: boolean) => void;
  setSidebarOpenMobile: (sidebarOpenMobile: boolean) => void;
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void;
  sidebarOpen: boolean;
  sidebarOpenMobile: boolean;
  sidebarProjectIds: Set<string>;
  syncSidebarProjects: (projectIds: string[]) => void;
  toggleSidebarChatDateGroup: (groupKey: SidebarChatDateGroupKey) => void;
  toggleSidebarProject: (projectId: string) => void;
  workspaceMode: WorkspaceMode;
}

export const useWorkspaceUiStore = create<WorkspaceUiState>()((set) => ({
  collapsedChatDateGroupKeys: new Set(),
  expandedProjectIds: new Set(),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSidebarOpenMobile: (sidebarOpenMobile) => set({ sidebarOpenMobile }),
  setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
  sidebarOpen: true,
  sidebarOpenMobile: false,
  sidebarProjectIds: new Set(),
  syncSidebarProjects: (projectIds) =>
    set((current) => {
      const nextProjectIds = new Set(projectIds);
      const currentProjectIds = current.sidebarProjectIds;
      if (setsEqual(currentProjectIds, nextProjectIds)) {
        return current;
      }

      const nextExpandedProjectIds = new Set(current.expandedProjectIds);
      for (const projectId of currentProjectIds) {
        if (!nextProjectIds.has(projectId)) {
          nextExpandedProjectIds.delete(projectId);
        }
      }
      for (const projectId of nextProjectIds) {
        if (!currentProjectIds.has(projectId)) {
          nextExpandedProjectIds.add(projectId);
        }
      }

      return {
        expandedProjectIds: nextExpandedProjectIds,
        sidebarProjectIds: nextProjectIds,
      };
    }),
  toggleSidebarChatDateGroup: (groupKey) =>
    set((current) => {
      const collapsedChatDateGroupKeys = new Set(
        current.collapsedChatDateGroupKeys,
      );
      if (collapsedChatDateGroupKeys.has(groupKey)) {
        collapsedChatDateGroupKeys.delete(groupKey);
      } else {
        collapsedChatDateGroupKeys.add(groupKey);
      }
      return { collapsedChatDateGroupKeys };
    }),
  toggleSidebarProject: (projectId) =>
    set((current) => {
      const expandedProjectIds = new Set(current.expandedProjectIds);
      if (expandedProjectIds.has(projectId)) {
        expandedProjectIds.delete(projectId);
      } else {
        expandedProjectIds.add(projectId);
      }
      return { expandedProjectIds };
    }),
  workspaceMode: "chat",
}));

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}
