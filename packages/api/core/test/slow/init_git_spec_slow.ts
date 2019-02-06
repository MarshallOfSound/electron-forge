import { execSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import { expect } from 'chai';

import initGit from '../../src/api/init-scripts/init-git';

let dir: string;
let dirID = Date.now();

const ensureTestDirIsNonexistent = async () => {
  dir = path.resolve(os.tmpdir(), `electron-forge-git-test-${dirID}`);
  dirID += 1;
  await fs.remove(dir);
};

describe('init-git', () => {
  beforeEach(async () => {
    await ensureTestDirIsNonexistent();
    await fs.mkdir(dir);
  });

  it('creates Git repository when run inside non-Git directory', async () => {
    await initGit(dir);
    const gitDir = path.join(dir, '.git');
    expect(await fs.pathExists(gitDir), 'the .git directory inside the folder').to.equal(true);
  });

  it('skips when run at root of Git repository', async () => {
    await execSync('git init', { cwd: dir });

    const gitDir = path.join(dir, '.git');
    const config = path.join(gitDir, 'config');
    const statBefore = await fs.lstat(config);
    const before = statBefore.mtimeMs;

    await initGit(dir);

    const statAfter = await fs.lstat(config);
    const after = statAfter.mtimeMs;

    expect(after, 'the config file in the repository').to.equal(before);
  });
});
