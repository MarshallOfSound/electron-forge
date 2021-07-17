#!/usr/bin/env node

require('colors');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('@malept/cross-spawn-promise')
const semver = require('semver');

const BASE_DIR = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.resolve(BASE_DIR, 'packages');
const ELECTRON_FORGE_PREFIX = '@electron-forge/';


async function run(command, args) {
  return spawn(command, args, { cwd: BASE_DIR });
}

async function git(*args) {
  return run('git', args)
}

async function checkCleanWorkingDir() {
  if ((await git('status', '--short')) !== '') {
    throw 'Your working directory is not clean, please ensure you have a clean working directory before version bumping'.red;
  }
}

async function updateChangelog(lastVersion, version) {
  await run('node_modules/.bin/changelog', [`--tag=v${lastVersion}..v${version}`]);

  require('../ci/fix-changelog'); // eslint-disable-line global-require

  await git('add', 'CHANGELOG.md');
  await git('commit', '-m', `Update CHANGELOG.md for ${version}`);
}

(async () => {
  await checkCleanWorkingDir();

  const version = process.argv[2];
  if (!version) {
    throw 'Must provide a version in argv[2]'.red;
  }
  if (!semver.valid(version)) {
    throw `Must provide a valid semver version in argv[2].  Got ${version}`.red;
  }

  console.info(`Setting version of all dependencies: ${version.cyan}`);

  const { version: lastVersion } = await fs.readJson(path.join(BASE_DIR, 'package.json'));
  const dirsToUpdate = [BASE_DIR];

  for (const subDir of await fs.readdir(PACKAGES_DIR)) {
    for (const packageDir of await fs.readdir(path.resolve(PACKAGES_DIR, subDir))) {
      dirsToUpdate.push(path.resolve(PACKAGES_DIR, subDir, packageDir));
    }
  }

  for (const dir of dirsToUpdate) {
    const pjPath = path.resolve(dir, 'package.json');
    const existingPJ = await fs.readJson(pjPath);
    existingPJ.version = version;
    for (const type of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const depKey in existingPJ[type]) {
        if (depKey.startsWith(ELECTRON_FORGE_PREFIX)) {
          existingPJ[type][depKey] = version;
        }
      }
    }
    await fs.writeJson(pjPath, existingPJ, {
      spaces: 2,
    });
    await git('add', path.relative(BASE_DIR, pjPath));
  }

  await git('commit', '-m', `Release ${version}`);
  await git('tag', `v${version}`);

  await updateChangelog(lastVersion, version);

  // re-tag to include the changelog
  await git(`git tag --force v${version}`);
})().catch(console.error);
