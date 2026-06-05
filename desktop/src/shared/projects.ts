export interface Project {
  id: string;
  path: string;
}

export interface ProjectGitStatusInput {
  projectId: string;
}

export interface ProjectGitStatusResult {
  branch?: string;
  isDirty: boolean;
  isGitRepository: boolean;
  path: string;
  projectId: string;
  root?: string;
}

export interface ProjectWorktreeCreateInput {
  projectId: string;
}

export interface ProjectWorktreeCreateResult {
  branch: string;
  cwd: string;
  projectId: string;
  root: string;
}

export interface CreateProjectInput {
  id?: string;
  path: string;
}

export interface UpdateProjectInput {
  id: string;
  path: string;
}
