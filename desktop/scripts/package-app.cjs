const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const packageApp = require("@electron-forge/core/dist/api/package").default;

const desktopRoot = path.resolve(__dirname, "..");
const outDir = path.join(desktopRoot, "out");
const packagedAppPathFile = path.join(outDir, ".prepackaged-app");

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
  for (const entry of fs.readdirSync(outDir, { recursive: true })) {
    console.error(path.join(outDir, entry.toString()));
  }
}

function packagedAppDir() {
  return path.join(outDir, `Angel Engine-${process.platform}-${process.arch}`);
}

function selectAppBundle(appBundles) {
  const preferredAppPath = path.join(packagedAppDir(), "Angel Engine.app");

  return appBundles.includes(preferredAppPath)
    ? preferredAppPath
    : appBundles[0];
}

function resolveNonMacPackagedApp() {
  const dir = packagedAppDir();
  return fs.existsSync(dir) ? dir : undefined;
}

async function main() {
  console.log(`Packaging Angel Engine for ${process.platform}/${process.arch}`);
  fs.rmSync(packagedAppPathFile, { force: true });

  const results = await packageApp({
    arch: process.arch,
    dir: desktopRoot,
    interactive: false,
    outDir,
    platform: process.platform,
  });

  for (const result of results ?? []) {
    console.log(
      `Packaged ${result.platform}/${result.arch}: ${path.relative(
        desktopRoot,
        result.packagedPath,
      )}`,
    );
  }

  const appPath =
    process.platform === "darwin"
      ? selectAppBundle(findAppBundles(outDir))
      : resolveNonMacPackagedApp();

  if (!appPath) {
    printOutTree();
    throw new Error(
      `No packaged app found after Forge completed for ${process.platform}/${process.arch}.`,
    );
  }

  fs.writeFileSync(packagedAppPathFile, `${appPath}\n`);
  console.log(`Prepared app bundle: ${path.relative(desktopRoot, appPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
