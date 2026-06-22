const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const desktopRoot = path.resolve(__dirname, "..");
const outDir = path.join(desktopRoot, "out");
const packagedAppPathFile = path.join(outDir, ".prepackaged-app");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
);
const releaseType = packageJson.version.includes("-")
  ? "prerelease"
  : "release";
const electronBuilderCli = path.join(
  desktopRoot,
  "node_modules",
  "electron-builder",
  "cli.js",
);

const publishIndex = process.argv.indexOf("--publish");
const publishMode =
  publishIndex === -1 ? "never" : process.argv[publishIndex + 1];
const waitMs = Number(
  process.env.ANGEL_ENGINE_PREPACKAGED_APP_WAIT_MS ?? 600000,
);
const pollMs = 5000;

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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function directorySize(dir) {
  let size = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    try {
      if (entry.isDirectory()) {
        size += directorySize(entryPath);
      } else {
        size += fs.statSync(entryPath).size;
      }
    } catch {
      return -1;
    }
  }

  return size;
}

function printOutTree() {
  if (!fs.existsSync(outDir)) {
    console.error(`Forge output directory does not exist: ${outDir}`);
    return;
  }

  console.error("Forge output tree:");
  for (const entry of fs.readdirSync(outDir, { recursive: true })) {
    console.error(path.join(outDir, entry.toString()));
  }
}

function expectedPackagedAppPath() {
  const dir = path.join(
    outDir,
    `Angel Engine-${process.platform}-${process.arch}`,
  );

  if (process.platform === "darwin") {
    return path.join(dir, "Angel Engine.app");
  }

  return dir;
}

function readPackagedAppPath() {
  if (!fs.existsSync(packagedAppPathFile)) {
    return undefined;
  }

  const appPath = fs.readFileSync(packagedAppPathFile, "utf8").trim();

  if (!appPath) {
    return undefined;
  }

  return path.resolve(desktopRoot, appPath);
}

function selectAppBundle() {
  const packagedAppPath = readPackagedAppPath();

  if (process.platform === "darwin") {
    const appBundles = findAppBundles(outDir);
    const expected = expectedPackagedAppPath();
    const appPath =
      packagedAppPath && fs.existsSync(packagedAppPath)
        ? packagedAppPath
        : appBundles.includes(expected)
          ? expected
          : appBundles[0];

    return { appBundles, appPath };
  }

  if (packagedAppPath && fs.existsSync(packagedAppPath)) {
    return { appBundles: [], appPath: packagedAppPath };
  }

  const expected = expectedPackagedAppPath();

  return {
    appBundles: [],
    appPath: fs.existsSync(expected) ? expected : undefined,
  };
}

function waitForAppBundle() {
  const deadline = Date.now() + waitMs;
  let lastSize = -1;
  let lastAppPath;

  while (Date.now() <= deadline) {
    const { appBundles, appPath } = selectAppBundle();

    if (appPath) {
      const size = directorySize(appPath);

      if (appPath === lastAppPath && size > 0 && size === lastSize) {
        return { appBundles, appPath };
      }

      lastAppPath = appPath;
      lastSize = size;
      console.log(
        `Waiting for packaged app to settle: ${path.relative(
          desktopRoot,
          appPath,
        )}`,
      );
    } else {
      console.log(
        `Waiting for Forge output: ${path.relative(desktopRoot, outDir)}`,
      );
    }

    sleep(pollMs);
  }

  return selectAppBundle();
}

const { appBundles, appPath } = waitForAppBundle();

if (!appPath) {
  printOutTree();
  throw new Error(
    `No packaged app found under desktop/out for ${process.platform}/${process.arch}.`,
  );
}

if (appBundles.length > 1) {
  console.warn(`Found multiple app bundles, using: ${appPath}`);
}

const builderTargets =
  process.platform === "darwin"
    ? ["--mac", "dmg", "zip"]
    : process.platform === "win32"
      ? ["--win", "nsis", "portable"]
      : ["--linux", "AppImage"];

console.log(`Using prepackaged app: ${path.relative(desktopRoot, appPath)}`);

execFileSync(
  process.execPath,
  [
    electronBuilderCli,
    "--prepackaged",
    appPath,
    ...builderTargets,
    `--config.publish.releaseType=${releaseType}`,
    "--publish",
    publishMode,
  ],
  {
    cwd: desktopRoot,
    stdio: "inherit",
  },
);
