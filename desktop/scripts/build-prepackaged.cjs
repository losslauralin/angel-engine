const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const desktopRoot = path.resolve(__dirname, "..");
const outDir = path.join(desktopRoot, "out");
const electronBuilderBin = path.join(
  desktopRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
);

const publishIndex = process.argv.indexOf("--publish");
const publishMode =
  publishIndex === -1 ? "never" : process.argv[publishIndex + 1];

if (
  !publishMode ||
  !["always", "never", "onTag", "onTagOrDraft"].includes(publishMode)
) {
  throw new Error(`Unsupported publish mode: ${publishMode}`);
}

function findAppBundles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const apps = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      apps.push(entryPath);
      continue;
    }

    if (entry.isDirectory()) {
      apps.push(...findAppBundles(entryPath));
    }
  }

  return apps;
}

function printOutTree() {
  if (!fs.existsSync(outDir)) {
    console.error(`Forge output directory does not exist: ${outDir}`);
    return;
  }

  console.error("Forge output tree:");
  execFileSync("find", [outDir, "-maxdepth", "3", "-print"], {
    cwd: desktopRoot,
    stdio: "inherit",
  });
}

const appBundles = findAppBundles(outDir);
const preferredAppPath = path.join(
  outDir,
  "Angel Engine-darwin-arm64",
  "Angel Engine.app",
);
const appPath = appBundles.includes(preferredAppPath)
  ? preferredAppPath
  : appBundles[0];

if (!appPath) {
  printOutTree();
  throw new Error("No packaged .app bundle found under desktop/out.");
}

if (appBundles.length > 1) {
  console.warn(`Found multiple app bundles, using: ${appPath}`);
}

console.log(`Using prepackaged app: ${path.relative(desktopRoot, appPath)}`);

execFileSync(
  electronBuilderBin,
  ["--prepackaged", appPath, "--mac", "dmg", "zip", "--publish", publishMode],
  {
    cwd: desktopRoot,
    stdio: "inherit",
  },
);
