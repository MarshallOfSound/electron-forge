import 'colors';
import { ora as realOra, fakeOra, OraImpl } from '@electron-forge/async-ora';
import { ForgeArch, ForgePlatform } from '@electron-forge/shared-types';
import debug from 'debug';
import fs from 'fs-extra';
import { getHostArch } from '@electron/get';
import glob from 'glob';
import packager from 'electron-packager';
import path from 'path';
import { promisify } from 'util';

import getForgeConfig from '../util/forge-config';
import { runHook } from '../util/hook';
import { warn } from '../util/messages';
import { readMutatedPackageJson } from '../util/read-package-json';
import rebuildHook from '../util/rebuild';
import requireSearch from '../util/require-search';
import resolveDir from '../util/resolve-dir';
import getCurrentOutDir from '../util/out-dir';
import { getElectronVersion } from '../util/electron-version';

const d = debug('electron-forge:packager');

type ElectronPackagerAfterCopyHook = (
  buildPath: string,
  electronVersion: string,
  pPlatform: ForgePlatform,
  pArch: ForgeArch,
  done: (err?: Error) => void
) => void;

/**
 * Resolves hooks if they are a path to a file (instead of a `Function`).
 */
function resolveHooks(hooks: (string | ElectronPackagerAfterCopyHook)[] | undefined, dir: string) {
  if (hooks) {
    return hooks.map((hook) => (
      typeof hook === 'string'
        ? requireSearch<ElectronPackagerAfterCopyHook>(dir, [hook]) as ElectronPackagerAfterCopyHook
        : hook
    ));
  }

  return [];
}

/**
 * Runs given hooks sequentially by mapping them to promises and iterating
 * through while awaiting
 */
function sequentialHooks(hooks: Function[]) {
  return [async (...args: any[]) => {
    const done = args[args.length - 1];
    const passedArgs = args.splice(0, args.length - 1);
    for (const hook of hooks) {
      await promisify(hook)(...passedArgs);
    }
    done();
  }] as [(...args: any[]) => Promise<void>];
}

export interface PackageOptions {
  /**
   * The path to the app to package
   */
  dir?: string;
  /**
   * Whether to use sensible defaults or prompt the user visually
   */
  interactive?: boolean;
  /**
   * The target arch
   */
  arch?: ForgeArch;
  /**
   * The target platform.
   */
  platform?: ForgePlatform;
  /**
   * The path to the output directory for packaged apps
   */
  outDir?: string;
}

export default async ({
  dir = process.cwd(),
  interactive = false,
  arch = getHostArch() as ForgeArch,
  platform = process.platform as ForgePlatform,
  outDir,
}: PackageOptions) => {
  const ora = interactive ? realOra : fakeOra;

  let prepareSpinner = ora(`Preparing to Package Application for arch: ${(arch === 'all' ? 'ia32' : arch).cyan}`).start();
  let prepareCounter = 0;

  const resolvedDir = await resolveDir(dir);
  if (!resolvedDir) {
    throw new Error('Failed to locate compilable Electron application');
  }
  dir = resolvedDir;

  const forgeConfig = await getForgeConfig(dir);
  const packageJSON = await readMutatedPackageJson(dir, forgeConfig);

  if (!packageJSON.main) {
    throw new Error('packageJSON.main must be set to a valid entry point for your Electron app');
  }

  const calculatedOutDir = outDir || getCurrentOutDir(dir, forgeConfig);
  let packagerSpinner: OraImpl | null = null;

  const pruneEnabled = !('prune' in forgeConfig.packagerConfig) || forgeConfig.packagerConfig.prune;

  const afterCopyHooks: ElectronPackagerAfterCopyHook[] = [
    async (buildPath, electronVersion, pPlatform, pArch, done) => {
      if (packagerSpinner) {
        packagerSpinner.succeed();
        prepareCounter += 1;
        prepareSpinner = ora(`Preparing to Package Application for arch: ${(prepareCounter === 2 ? 'armv7l' : 'x64').cyan}`).start();
      }
      const bins = await promisify(glob)(path.join(buildPath, '**/.bin/**/*'));
      for (const bin of bins) {
        await fs.remove(bin);
      }
      done();
    }, async (buildPath, electronVersion, pPlatform, pArch, done) => {
      prepareSpinner.succeed();
      await runHook(forgeConfig, 'packageAfterCopy', buildPath, electronVersion, pPlatform, pArch);
      done();
    },
    async (buildPath, electronVersion, pPlatform, pArch, done) => {
      await rebuildHook(
        buildPath,
        electronVersion,
        pPlatform,
        pArch,
        forgeConfig.electronRebuildConfig,
      );
      packagerSpinner = ora('Packaging Application').start();
      done();
    },
  ];

  afterCopyHooks.push(async (buildPath, electronVersion, pPlatform, pArch, done) => {
    const copiedPackageJSON = await readMutatedPackageJson(buildPath, forgeConfig);
    if (copiedPackageJSON.config && copiedPackageJSON.config.forge) {
      delete copiedPackageJSON.config.forge;
    }
    await fs.writeJson(path.resolve(buildPath, 'package.json'), copiedPackageJSON, { spaces: 2 });
    done();
  });

  afterCopyHooks.push(...resolveHooks(forgeConfig.packagerConfig.afterCopy, dir));

  const afterPruneHooks = [];

  if (pruneEnabled) {
    afterPruneHooks.push(...resolveHooks(forgeConfig.packagerConfig.afterPrune, dir));
  }

  afterPruneHooks.push((async (buildPath, electronVersion, pPlatform, pArch, done) => {
    await runHook(forgeConfig, 'packageAfterPrune', buildPath, electronVersion, pPlatform, pArch);
    done();
  }) as ElectronPackagerAfterCopyHook);

  const afterExtractHooks = [(async (buildPath, electronVersion, pPlatform, pArch, done) => {
    await runHook(forgeConfig, 'packageAfterExtract', buildPath, electronVersion, pPlatform, pArch);
    done();
  }) as ElectronPackagerAfterCopyHook];
  afterExtractHooks.push(...resolveHooks(forgeConfig.packagerConfig.afterExtract, dir));

  type PackagerArch = Exclude<ForgeArch, 'arm'>;

  const packageOpts: packager.Options = {
    asar: false,
    overwrite: true,
    dir,
    ...forgeConfig.packagerConfig,
    arch: arch as PackagerArch,
    platform,
    afterCopy: sequentialHooks(afterCopyHooks),
    afterExtract: sequentialHooks(afterExtractHooks),
    afterPrune: sequentialHooks(afterPruneHooks),
    out: calculatedOutDir,
    electronVersion: await getElectronVersion(dir, packageJSON),
  };
  packageOpts.quiet = true;

  if (packageOpts.all) {
    throw new Error('config.forge.packagerConfig.all is not supported by Electron Forge');
  }

  if (!packageJSON.version && !packageOpts.appVersion) {
    // eslint-disable-next-line max-len
    warn(interactive, 'Please set "version" or "config.forge.packagerConfig.appVersion" in your application\'s package.json so auto-updates work properly'.yellow);
  }

  if (packageOpts.prebuiltAsar) {
    throw new Error('config.forge.packagerConfig.prebuiltAsar is not supported by Electron Forge');
  }

  await runHook(forgeConfig, 'generateAssets', platform, arch);
  await runHook(forgeConfig, 'prePackage');

  d('packaging with options', packageOpts);

  const outputPaths = await packager(packageOpts);

  await runHook(forgeConfig, 'postPackage', {
    arch,
    outputPaths,
    platform,
    spinner: packagerSpinner,
  });

  if (packagerSpinner) packagerSpinner!.succeed();
};
