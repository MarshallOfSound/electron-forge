import { api, PackageOptions } from '@electron-forge/core';

import fs from 'fs-extra';
import { initializeProxy } from '@electron/get';
import program from 'commander';
import path from 'path';

import './util/terminate';
import workingDir from './util/working-dir';

(async () => {
  let dir: string = process.cwd();
  program
    .version((await fs.readJson(path.resolve(__dirname, '../package.json'))).version)
    .arguments('[cwd]')
    .option('-a, --arch [arch]', 'Target architecture')
    .option('-p, --platform [platform]', 'Target build platform')
    .allowUnknownOption(true)
    .action((cwd) => { dir = workingDir(dir, cwd); })
    .parse(process.argv);

  initializeProxy();

  const packageOpts: PackageOptions = {
    dir,
    interactive: true,
  };
  if (program.arch) packageOpts.arch = program.arch;
  if (program.platform) packageOpts.platform = program.platform;

  await api.package(packageOpts);
})();
