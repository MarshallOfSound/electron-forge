import 'colors';
import { asyncOra } from '@electron-forge/async-ora';
import debug from 'debug';
import {
  ElectronProcess, ForgeArch, ForgePlatform, StartOptions,
} from '@electron-forge/shared-types';
import { spawn, SpawnOptions } from 'child_process';

import { getElectronVersion } from '../util/electron-version';
import getForgeConfig from '../util/forge-config';
import locateElectronExecutable from '../util/electron-executable';
import { readMutatedPackageJson } from '../util/read-package-json';
import rebuild from '../util/rebuild';
import resolveDir from '../util/resolve-dir';
import { runHook } from '../util/hook';

const d = debug('electron-forge:start');

export { StartOptions };

export default async ({
  dir = process.cwd(),
  appPath = '.',
  interactive = false,
  enableLogging = false,
  args = [],
  runAsNode = false,
  inspect = false,
  inspectBrk = false,
}: StartOptions) => {
  asyncOra.interactive = interactive;

  await asyncOra('Locating Application', async () => {
    const resolvedDir = await resolveDir(dir);
    if (!resolvedDir) {
      throw new Error('Failed to locate startable Electron application');
    }
    dir = resolvedDir;
  });

  const forgeConfig = await getForgeConfig(dir);
  const packageJSON = await readMutatedPackageJson(dir, forgeConfig);

  if (!packageJSON.version) {
    throw new Error(`Please set your application's 'version' in '${dir}/package.json'.`);
  }

  const platform = process.env.npm_config_platform || process.platform;
  const arch = process.env.npm_config_arch || process.arch;

  await rebuild(
    dir,
    await getElectronVersion(dir, packageJSON),
    platform as ForgePlatform,
    arch as ForgeArch,
    forgeConfig.electronRebuildConfig,
  );

  await runHook(forgeConfig, 'generateAssets', platform, arch);

  let lastSpawned: ElectronProcess | null = null;

  const forgeSpawn = async () => {
    let electronExecPath: string | null = null;

    // If a plugin has taken over the start command let's stop here
    const spawnedPluginChild = await forgeConfig.pluginInterface.overrideStartLogic({
      dir,
      appPath,
      interactive,
      enableLogging,
      args,
      runAsNode,
      inspect,
      inspectBrk,
    });
    let prefixArgs: string[] = [];
    if (typeof spawnedPluginChild === 'string') {
      electronExecPath = spawnedPluginChild;
    } else if (Array.isArray(spawnedPluginChild)) {
      [electronExecPath, ...prefixArgs] = spawnedPluginChild;
    } else if (spawnedPluginChild) {
      await runHook(forgeConfig, 'postStart', spawnedPluginChild);
      return spawnedPluginChild;
    }

    if (!electronExecPath) {
      electronExecPath = await locateElectronExecutable(dir, packageJSON);
    }

    d('Electron binary path:', electronExecPath);

    const spawnOpts = {
      cwd: dir,
      stdio: 'inherit',
      env: ({
        ...process.env,
        ...(enableLogging ? {
          ELECTRON_ENABLE_LOGGING: 'true',
          ELECTRON_ENABLE_STACK_DUMPING: 'true',
        } : {}),
      }) as NodeJS.ProcessEnv,
    };

    if (runAsNode) {
      spawnOpts.env.ELECTRON_RUN_AS_NODE = 'true';
    } else {
      delete spawnOpts.env.ELECTRON_RUN_AS_NODE;
    }

    if (inspect) {
      args = ['--inspect' as (string|number)].concat(args);
    }
    if (inspectBrk) {
      args = ['--inspect-brk' as (string|number)].concat(args);
    }

    let spawned!: ElectronProcess;

    await asyncOra('Launching Application', async () => {
      spawned = spawn(
        electronExecPath!,
        prefixArgs.concat([appPath]).concat(args as string[]),
        spawnOpts as SpawnOptions,
      ) as ElectronProcess;
    });

    await runHook(forgeConfig, 'postStart', spawned);
    return spawned;
  };

  const forgeSpawnWrapper = async () => {
    const spawned = await forgeSpawn();
    // When the child app is closed we should stop listening for stdin
    if (spawned) {
      if (interactive && process.stdin.isPaused()) {
        process.stdin.resume();
      }
      spawned.on('exit', () => {
        if (spawned.restarted) return;

        if (!process.stdin.isPaused()) process.stdin.pause();
      });
    } else if (interactive && !process.stdin.isPaused()) {
      process.stdin.pause();
    }

    lastSpawned = spawned;
    return lastSpawned;
  };

  if (interactive) {
    process.stdin.on('data', async (data) => {
      if (data.toString().trim() === 'rs' && lastSpawned) {
        // eslint-disable-next-line no-console
        console.info('\nRestarting App\n'.cyan);
        lastSpawned.restarted = true;
        lastSpawned.kill('SIGTERM');
        lastSpawned.emit('restarted', await forgeSpawnWrapper());
      }
    });
  }

  return forgeSpawnWrapper();
};
