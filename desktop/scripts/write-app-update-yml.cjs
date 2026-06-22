const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const desktopRoot = path.resolve(__dirname, "..");
const targetPath = path.join(desktopRoot, "build", "app-update.yml");

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

function resolveSlug() {
  const githubRepository = process.env.GITHUB_REPOSITORY;

  if (githubRepository && githubRepository.includes("/")) {
    const [owner, repo] = githubRepository.split("/");
    return { owner, repo };
  }

  return resolveSlugFromGitOrigin();
}

const slug = resolveSlug();

if (!slug) {
  throw new Error(
    "Could not resolve GitHub owner/repo for app-update.yml. " +
      "Set GITHUB_REPOSITORY or configure a github.com remote.origin.url.",
  );
}

const contents = [
  "provider: github",
  `owner: ${slug.owner}`,
  `repo: ${slug.repo}`,
  "updaterCacheDirName: angel-engine-updater",
  "",
].join("\n");

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, contents);
console.log(`Wrote ${path.relative(desktopRoot, targetPath)}`);
console.log(`  owner: ${slug.owner}`);
console.log(`  repo: ${slug.repo}`);
