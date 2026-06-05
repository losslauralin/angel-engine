import type {
  ProjectGitStatusInput,
  ProjectGitStatusResult,
  ProjectWorktreeCreateInput,
  ProjectWorktreeCreateResult,
} from "../../../shared/projects";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { getProject } from "./repository";

const execFileAsync = promisify(execFile);
const GIT_OUTPUT_MAX_BUFFER = 1024 * 1024;
const WORKTREE_BRANCH_PREFIX = "angel";

export async function projectGitStatus(
  input: ProjectGitStatusInput,
): Promise<ProjectGitStatusResult> {
  const project = getProject(input.projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const baseResult = {
    isDirty: false,
    isGitRepository: false,
    path: project.path,
    projectId: project.id,
  };

  try {
    const root = await gitOutput(project.path, [
      "rev-parse",
      "--show-toplevel",
    ]);
    const branch = await gitOutput(project.path, [
      "branch",
      "--show-current",
    ]).catch(() => "");
    const status = await gitOutput(project.path, ["status", "--porcelain"]);

    return {
      ...baseResult,
      branch: nonEmpty(branch),
      isDirty: status.trim().length > 0,
      isGitRepository: true,
      root: root.trim(),
    };
  } catch {
    return baseResult;
  }
}

export async function createProjectWorktree(
  input: ProjectWorktreeCreateInput,
): Promise<ProjectWorktreeCreateResult> {
  const status = await projectGitStatus(input);
  if (!status.isGitRepository || !status.root) {
    throw new Error("Project is not a git repository.");
  }

  const projectSlug = projectSlugFromPath(status.path);
  const parent = path.join(managedWorktreeRoot(), projectSlug);
  fs.mkdirSync(parent, { recursive: true });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
    const cwd = path.join(parent, suffix);
    const branch = `${WORKTREE_BRANCH_PREFIX}/${projectSlug}-${suffix}`;

    try {
      await execFileAsync(
        "git",
        ["-C", status.root, "worktree", "add", "-b", branch, cwd, "HEAD"],
        { maxBuffer: GIT_OUTPUT_MAX_BUFFER },
      );
      return {
        branch,
        cwd,
        projectId: input.projectId,
        root: status.root,
      };
    } catch (error) {
      fs.rmSync(cwd, { force: true, recursive: true });
      if (attempt === 4) {
        throw normalizeGitError(error, "Could not create git worktree.");
      }
    }
  }

  throw new Error("Could not create git worktree.");
}

function managedWorktreeRoot() {
  return path.join(os.homedir(), ".angel-engine", "worktrees");
}

function projectSlugFromPath(projectPath: string) {
  const slug = path
    .basename(projectPath)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "project";
}

async function gitOutput(cwd: string, args: string[]) {
  const result = await execFileAsync("git", ["-C", cwd, ...args], {
    maxBuffer: GIT_OUTPUT_MAX_BUFFER,
  });
  return result.stdout.trim();
}

function nonEmpty(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeGitError(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; stderr?: unknown };
    if (typeof maybeError.stderr === "string" && maybeError.stderr.trim()) {
      return new Error(maybeError.stderr.trim());
    }
    if (typeof maybeError.message === "string" && maybeError.message.trim()) {
      return new Error(maybeError.message.trim());
    }
  }
  return new Error(fallback);
}
