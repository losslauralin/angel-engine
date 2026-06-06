const path = require("node:path");
const { api } = require("@electron-forge/core");

const desktopRoot = path.resolve(__dirname, "..");
const outDir = path.join(desktopRoot, "out");

async function main() {
  const results = await api.package({
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
