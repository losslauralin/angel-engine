const fs = require("node:fs");
const path = require("node:path");
const { resolveGitHubSlug } = require("./resolve-github-slug.cjs");

const desktopRoot = path.resolve(__dirname, "..");
const targetPath = path.join(desktopRoot, "build", "app-update.yml");

const slug = resolveGitHubSlug();

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
