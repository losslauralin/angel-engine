exports.default = async function notarizeDmgArtifact(event) {
  if (!event.file || !event.file.endsWith(".dmg")) {
    return;
  }

  await event.packager.notarizeIfProvided(event.file);
};
