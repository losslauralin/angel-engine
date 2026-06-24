const { execSync } = require("node:child_process");
const path = require("node:path");

const desktopRoot = path.resolve(__dirname, "..");

function resolveSlugFromGitOrigin() {
  try {
    const url = execSync("git config --get remote.origin.url", {
      cwd: desktopRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (!url) {
      return undefined;
    }

    const match = url.match(/github\.com[:/]([^/]+)\/([^./\s]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    // git not available or no origin configured
  }

  return undefined;
}

function resolveGitHubSlug() {
  const githubRepository = process.env.GITHUB_REPOSITORY;

  if (githubRepository && githubRepository.includes("/")) {
    const [owner, repo] = githubRepository.split("/");
    return { owner, repo };
  }

  return resolveSlugFromGitOrigin();
}

module.exports = { resolveGitHubSlug };
