const path = require('path');
const fs = require('fs/promises');

const copyNagishliAssets = async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const sourceRoot = path.join(projectRoot, 'nagishli');
  const destinationRoot = path.join(projectRoot, 'public', 'nagishli');
  const itemsToCopy = ['nagishli.js', 'nl-files'];

  await fs.rm(destinationRoot, { recursive: true, force: true });
  await fs.mkdir(destinationRoot, { recursive: true });

  await Promise.all(
    itemsToCopy.map(async (item) => {
      const sourcePath = path.join(sourceRoot, item);
      const destinationPath = path.join(destinationRoot, item);
      await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
    })
  );

  console.log('[NagishLi] Assets copied to public/nagishli');
};

copyNagishliAssets().catch((error) => {
  console.error('[NagishLi] Failed to copy assets:', error);
  process.exit(1);
});
