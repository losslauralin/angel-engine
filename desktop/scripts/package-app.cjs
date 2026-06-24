const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const packageApp = require("@electron-forge/core/dist/api/package").default;

const desktopRoot = path.resolve(__dirname, "..");
const outDir = path.join(desktopRoot, "out");
const packagedAppPathFile = path.join(outDir, ".prepackaged-app");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
);
const productName = packageJson.productName;

// Forge packs each platform/arch into a directory named
// `<productName>-<platform>-<arch>` under the configured outDir.
function platformOutputDir(platform, arch) {
  return path.join(outDir, `${productName}-${platform}-${arch}`);
}

// macOS ships a `.app` bundle; Linux ships a bare executable named after the
// product; Windows ships an `.exe` named after the product.
function packagedExecutableName(platform) {
  if (platform === "win32") {
    return `${productName}.exe`;
  }

  return productName;
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

function findPackagedExecutable(dir) {
  if (!fs.existsSync(dir)) {
    return undefined;
  }

  const expected = packagedExecutableName(process.platform);
  const candidate = path.join(dir, expected);

  if (fs.existsSync(candidate)) {
    return candidate;
  }

  // Fall back to scanning the platform output directory for any file that
  // matches the executable naming convention, in case the productName was
  // sanitized differently than expected.
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) {
      if (
        (process.platform === "win32" && entry.name.endsWith(".exe")) ||
        (process.platform !== "win32" && entry.name === expected)
      ) {
        return path.join(dir, entry.name);
      }
    }
  }

  return undefined;
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

function selectAppBundle(appBundles) {
  const preferredAppPath = path.join(
    platformOutputDir("darwin", process.arch),
    `${productName}.app`,
  );

  return appBundles.includes(preferredAppPath)
    ? preferredAppPath
    : appBundles[0];
}

function selectPackagedApp() {
  // macOS: locate the `.app` bundle (existing behavior).
  if (process.platform === "darwin") {
    return selectAppBundle(findAppBundles(outDir));
  }

  // Linux / Windows: locate the executable inside the platform output dir.
  const executable = findPackagedExecutable(
    platformOutputDir(process.platform, process.arch),
  );

  return executable;
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

  const appPath = selectPackagedApp();

  if (!appPath) {
    printOutTree();
    const artifact =
      process.platform === "darwin"
        ? ".app bundle"
        : `${process.platform} executable`;
    throw new Error(`No packaged ${artifact} found after Forge completed.`);
  }

  fs.writeFileSync(packagedAppPathFile, `${appPath}\n`);
  console.log(`Prepared app bundle: ${path.relative(desktopRoot, appPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
