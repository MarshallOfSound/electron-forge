require('colors');
const childProcess = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('@malept/cross-spawn-promise');
const Listr = require('listr');
require('ts-node').register();

const BASE_DIR = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.resolve(BASE_DIR, 'packages');

const prepare = new Listr([
  {
    title: 'Checking working directory',
    task: async () => {
      if (childProcess.execSync('git status -s', {
        cwd: BASE_DIR,
      }).toString() !== '') {
        throw new Error('Your working directory is not clean, please ensure you have a clean working directory before publishing'.red);
      }
    },
  },
  {
    title: 'Building all packages',
    task: () => spawn('yarn', ['build'], {
      cwd: BASE_DIR,
    }),
  },
  {
    title: 'Fetching README\'s',
    task: require('./sync-readmes'),
  },
]);

const publisher = new Listr([
  {
    title: 'Collecting directories to publish',
    task: async (ctx) => {
      ctx.dirsToPublish = [];
      for (const subDir of await fs.readdir(PACKAGES_DIR)) {
        for (const packageDir of await fs.readdir(path.resolve(PACKAGES_DIR, subDir))) {
          ctx.dirsToPublish.push(path.resolve(PACKAGES_DIR, subDir, packageDir));
        }
      }
    },
  },
  {
    title: 'Publishing all packages',
    task: async (ctx) => {
      return new Listr(await Promise.all(ctx.dirsToPublish.map(async (dir) => {
        const { name, version } = await fs.readJson(path.resolve(dir, 'package.json'));
        // TODO: Re-enable this once V6 stable is released
        // const isBeta = version.includes('beta');
        const isBeta = false;
        return {
          title: `Publishing: ${`${name}@${version}`.cyan} (beta=${isBeta ? 'true'.green : 'false'.red})`,
          task: async () => {
            try {
              await spawn('npm', ['publish', '--access=public', ...(isBeta ? ['--tag=beta'] : []), `--otp=${ctx.otp}`], {
                cwd: dir,
              });
            } catch (err) {
              throw new Error(`Failed to publish ${`${name}@${version}`.cyan} \n${err.stderr.toString()}`);
            }
          },
        };
      })), { concurrent: 5, exitOnError: false });
    },
  },
]);

const runPublisher = async () => {
  const otp = await new Promise((resolve) => {
    process.stdin.once('data', (chunk) => {
      process.stdin.pause();
      resolve(chunk.toString());
    });
    process.stdout.write('Enter OTP: ');
    process.stdin.read();
  });
  publisher.run({ otp });
}

prepare
  .run()
  .then(runPublisher)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
