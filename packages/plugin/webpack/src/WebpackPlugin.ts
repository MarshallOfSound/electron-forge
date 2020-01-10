/* eslint "no-console": "off" */
import { asyncOra } from '@electron-forge/async-ora';
import PluginBase from '@electron-forge/plugin-base';
import { ElectronProcess, ForgeConfig } from '@electron-forge/shared-types';
import Logger, { Tab } from '@electron-forge/web-multi-logger';
import debug from 'debug';
import fs from 'fs-extra';
import merge from 'webpack-merge';
import path from 'path';
import webpack, { Configuration } from 'webpack';
import webpackHotMiddleware from 'webpack-hot-middleware';
import webpackDevMiddleware from 'webpack-dev-middleware';
import express from 'express';
import http from 'http';

import HtmlWebpackPlugin from 'html-webpack-plugin';

import once from './util/once';
import { WebpackPluginConfig, WebpackPluginEntryPoint, WebpackPreloadEntryPoint } from './Config';

const d = debug('electron-forge:plugin:webpack');
const DEFAULT_PORT = 3000;
const DEFAULT_LOGGER_PORT = 9000;

type EntryType = string | string[] | Record<string, string | string[]>;

export default class WebpackPlugin extends PluginBase<WebpackPluginConfig> {
  name = 'webpack';

  private isProd = false;

  private projectDir!: string;

  private baseDir!: string;

  private watchers: webpack.Compiler.Watching[] = [];

  private servers: http.Server[] = [];

  private loggers: Logger[] = [];

  private port = DEFAULT_PORT;

  private loggerPort = DEFAULT_LOGGER_PORT;

  constructor(c: WebpackPluginConfig) {
    super(c);

    if (c.port) {
      if (this.isValidPort(c.port)) {
        this.port = c.port;
      }
    }
    if (c.loggerPort) {
      if (this.isValidPort(c.loggerPort)) {
        this.loggerPort = c.loggerPort;
      }
    }

    this.startLogic = this.startLogic.bind(this);
    this.getHook = this.getHook.bind(this);
  }

  private isValidPort = (port: number) => {
    if (port < 1024) {
      throw new Error(`Cannot specify port (${port}) below 1024, as they are privileged`);
    } else if (port > 65535) {
      throw new Error(`Port specified (${port}) is not a valid TCP port.`);
    } else {
      return true;
    }
  }

  private resolveConfig = (config: Configuration | string) => {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    if (typeof config === 'string') return require(path.resolve(path.dirname(this.baseDir), config)) as Configuration;
    return config;
  }

  private exitHandler = (options: { cleanup?: boolean; exit?: boolean }, err?: Error) => {
    d('handling process exit with:', options);
    if (options.cleanup) {
      for (const watcher of this.watchers) {
        d('cleaning webpack watcher');
        watcher.close(() => {});
      }
      this.watchers = [];
      for (const server of this.servers) {
        d('cleaning http server');
        server.close();
      }
      this.servers = [];
      for (const logger of this.loggers) {
        d('stopping logger');
        logger.stop();
      }
      this.loggers = [];
    }
    if (err) console.error(err.stack);
    if (options.exit) process.exit();
  }

  // eslint-disable-next-line max-len
  private runWebpack = async (options: webpack.Configuration): Promise<webpack.Stats> => new Promise((resolve, reject) => {
    webpack(options)
      .run((err, stats) => {
        if (err) {
          return reject(err);
        }
        return resolve(stats);
      });
  });

  init = (dir: string) => {
    this.setDirectories(dir);

    d('hooking process events');
    process.on('exit', (_code) => this.exitHandler({ cleanup: true }));
    process.on('SIGINT' as NodeJS.Signals, (_signal) => this.exitHandler({ exit: true }));
  }

  setDirectories = (dir: string) => {
    this.projectDir = dir;
    this.baseDir = path.resolve(dir, '.webpack');
  }

  private loggedOutputUrl = false;

  getHook(name: string) {
    switch (name) {
      case 'prePackage':
        this.isProd = true;
        return async () => {
          await fs.remove(this.baseDir);
          await this.compileMain();
          await this.compileRenderers();
        };
      case 'postStart':
        return async (_: any, child: ElectronProcess) => {
          if (!this.loggedOutputUrl) {
            console.info(`\n\nWebpack Output Available: ${(`http://localhost:${this.loggerPort}`).cyan}\n`);
            this.loggedOutputUrl = true;
          }
          d('hooking electron process exit');
          child.on('exit', () => {
            if (child.restarted) return;
            this.exitHandler({ cleanup: true, exit: true });
          });
        };
      case 'resolveForgeConfig':
        return this.resolveForgeConfig;
      case 'packageAfterCopy':
        return this.packageAfterCopy;
      default:
        return null;
    }
  }

  resolveForgeConfig = async (forgeConfig: ForgeConfig) => {
    if (!forgeConfig.packagerConfig) {
      forgeConfig.packagerConfig = {};
    }
    if (forgeConfig.packagerConfig.ignore) {
      console.error(`You have set packagerConfig.ignore, the Electron Forge webpack plugin normally sets this automatically.

Your packaged app may be larger than expected if you dont ignore everything other than the '.webpack' folder`.red);
      return forgeConfig;
    }
    forgeConfig.packagerConfig.ignore = (file: string) => {
      if (!file) return false;

      return !/^[/\\]\.webpack($|[/\\]).*$/.test(file);
    };
    return forgeConfig;
  }

  packageAfterCopy = async (_: any, buildPath: string) => {
    const pj = await fs.readJson(path.resolve(this.projectDir, 'package.json'));
    if (pj.config) {
      delete pj.config.forge;
    }
    pj.devDependencies = {};
    pj.dependencies = {};
    pj.optionalDependencies = {};
    pj.peerDependencies = {};

    await fs.writeJson(
      path.resolve(buildPath, 'package.json'),
      pj,
      {
        spaces: 2,
      },
    );

    await fs.mkdirp(path.resolve(buildPath, 'node_modules'));
  }

  // eslint-disable-next-line max-len
  rendererEntryPoint = (entryPoint: WebpackPluginEntryPoint, inRendererDir: boolean, basename: string): string => {
    if (this.isProd) {
      return `\`file://$\{require('path').resolve(__dirname, '..', '${inRendererDir ? 'renderer' : '.'}', '${entryPoint.name}', '${basename}')}\``;
    }
    const baseUrl = `http://localhost:${this.port}/${entryPoint.name}`;
    if (basename !== 'index.html') {
      return `'${baseUrl}/${basename}'`;
    }
    return `'${baseUrl}'`;
  }

  toEnvironmentVariable = (entryPoint: WebpackPluginEntryPoint, preload = false): string => {
    const suffix = preload ? '_PRELOAD_WEBPACK_ENTRY' : '_WEBPACK_ENTRY';
    return `${entryPoint.name.toUpperCase().replace(/ /g, '_')}${suffix}`;
  }

  getPreloadDefine = (entryPoint: WebpackPluginEntryPoint): string => {
    if (entryPoint.preload) {
      if (this.isProd) {
        return `require('path').resolve(__dirname, '../renderer', '${entryPoint.name}', 'preload.js')`;
      }
      return `'${path.resolve(this.baseDir, 'renderer', entryPoint.name, 'preload.js').replace(/\\/g, '\\\\')}'`;
    }
    // If this entry-point has no configured preload script just map this constant to `undefined`
    // so that any code using it still works.  This makes quick-start / docs simpler.
    return 'undefined';
  }

  getDefines = (inRendererDir = true) => {
    const defines: { [key: string]: string; } = {
      ASSET_RELOCATOR_BASE_DIR: this.isProd
        ? `process.resourcesPath + "/" + (__filename.includes(".asar") ? "app.asar" : "app") + "/.webpack/${inRendererDir ? 'main' : 'renderer/any_folder'}"`
        : JSON.stringify(
          path.resolve(
            this.baseDir,
            inRendererDir ? 'main' : 'renderer',
            inRendererDir ? '.' : 'any_folder',
          ),
        ),
    };
    if (!this.config.renderer.entryPoints || !Array.isArray(this.config.renderer.entryPoints)) {
      throw new Error('Required config option "renderer.entryPoints" has not been defined');
    }
    for (const entryPoint of this.config.renderer.entryPoints) {
      const entryKey = this.toEnvironmentVariable(entryPoint);
      if (entryPoint.html) {
        defines[entryKey] = this.rendererEntryPoint(entryPoint, inRendererDir, 'index.html');
      } else {
        defines[entryKey] = this.rendererEntryPoint(entryPoint, inRendererDir, 'index.js');
      }
      defines[`process.env.${entryKey}`] = defines[entryKey];

      const preloadDefineKey = this.toEnvironmentVariable(entryPoint, true);
      defines[preloadDefineKey] = this.getPreloadDefine(entryPoint);
      defines[`process.env.${preloadDefineKey}`] = defines[preloadDefineKey];
    }
    return defines;
  }

  getMainConfig = async () => {
    const mainConfig = this.resolveConfig(this.config.mainConfig);

    if (!mainConfig.entry) {
      throw new Error('Required config option "entry" has not been defined');
    }
    const fix = (item: EntryType): EntryType => {
      if (typeof item === 'string') return (fix([item]) as string[])[0];
      if (Array.isArray(item)) {
        return item.map((val) => (val.startsWith('./') ? path.resolve(this.projectDir, val) : val));
      }
      const ret: Record<string, string | string[]> = {};
      for (const key of Object.keys(item)) {
        ret[key] = fix(item[key]) as string | string[];
      }
      return ret;
    };
    mainConfig.entry = fix(mainConfig.entry as EntryType);

    const defines = this.getDefines();
    return merge.smart({
      devtool: 'source-map',
      target: 'electron-main',
      mode: this.isProd ? 'production' : 'development',
      output: {
        path: path.resolve(this.baseDir, 'main'),
        filename: 'index.js',
        libraryTarget: 'commonjs2',
      },
      plugins: [
        new webpack.DefinePlugin(defines),
      ],
      node: {
        __dirname: false,
        __filename: false,
      },
      resolve: {
        modules: [
          path.resolve(path.dirname(this.baseDir), './'),
          path.resolve(path.dirname(this.baseDir), 'node_modules'),
          path.resolve(__dirname, '..', 'node_modules'),
        ],
      },
    }, mainConfig || {});
  }

  getPreloadRendererConfig = async (
    parentPoint: WebpackPluginEntryPoint,
    entryPoint: WebpackPreloadEntryPoint,
  ) => {
    const rendererConfig = this.resolveConfig(this.config.renderer.config);
    const prefixedEntries = entryPoint.prefixedEntries || [];

    return merge.smart({
      devtool: 'inline-source-map',
      target: 'electron-renderer',
      mode: this.isProd ? 'production' : 'development',
      entry: prefixedEntries.concat([
        entryPoint.js,
      ]),
      output: {
        path: path.resolve(this.baseDir, 'renderer', parentPoint.name),
        filename: 'preload.js',
      },
      node: {
        __dirname: false,
        __filename: false,
      },
    }, rendererConfig);
  }

  getRendererConfig = async (entryPoints: WebpackPluginEntryPoint[]) => {
    const rendererConfig = this.resolveConfig(this.config.renderer.config);
    const entry: webpack.Entry = {};
    for (const entryPoint of entryPoints) {
      const prefixedEntries = entryPoint.prefixedEntries || [];
      entry[entryPoint.name] = prefixedEntries
        .concat([entryPoint.js])
        .concat(this.isProd || !entryPoint.html ? [] : ['webpack-hot-middleware/client?reload=true']);
    }

    const defines = this.getDefines(false);
    return merge.smart({
      entry,
      devtool: 'inline-source-map',
      target: 'electron-renderer',
      mode: this.isProd ? 'production' : 'development',
      output: {
        path: path.resolve(this.baseDir, 'renderer'),
        filename: '[name]/index.js',
        globalObject: 'self',
        ...(this.isProd ? {} : { publicPath: '/' }),
      },
      node: {
        __dirname: false,
        __filename: false,
      },
      plugins: entryPoints.filter((entryPoint) => Boolean(entryPoint.html))
        .map((entryPoint) => new HtmlWebpackPlugin({
          title: entryPoint.name,
          template: entryPoint.html,
          filename: `${entryPoint.name}/index.html`,
          chunks: [entryPoint.name].concat(entryPoint.additionalChunks || []),
        })).concat([new webpack.DefinePlugin(defines)])
        .concat(this.isProd ? [] : [new webpack.HotModuleReplacementPlugin()]),
    }, rendererConfig);
  }

  compileMain = async (watch = false, logger?: Logger) => {
    let tab: Tab;
    if (logger) {
      tab = logger.createTab('Main Process');
    }
    await asyncOra('Compiling Main Process Code', async () => {
      const config = await this.getMainConfig();
      await new Promise((resolve, reject) => {
        const compiler = webpack(config);
        const [onceResolve, onceReject] = once(resolve, reject);
        const cb: webpack.ICompiler.Handler = (err, stats) => {
          if (tab && stats) {
            tab.log(stats.toString({
              colors: true,
            }));
          }

          if (err) return onceReject(err);
          if (!watch && stats.hasErrors()) {
            return onceReject(new Error(`Compilation errors in the main process: ${stats.toString()}`));
          }

          return onceResolve();
        };
        if (watch) {
          this.watchers.push(compiler.watch({}, cb));
        } else {
          compiler.run(cb);
        }
      });
    });
  }

  compileRenderers = async (watch = false) => { // eslint-disable-line @typescript-eslint/no-unused-vars, max-len
    await asyncOra('Compiling Renderer Template', async () => {
      const stats = await this.runWebpack(
        await this.getRendererConfig(this.config.renderer.entryPoints),
      );
      if (!watch && stats.hasErrors()) {
        throw new Error(`Compilation errors in the renderer: ${stats.toString()}`);
      }
    });

    for (const entryPoint of this.config.renderer.entryPoints) {
      if (entryPoint.preload) {
        await asyncOra(`Compiling Renderer Preload: ${entryPoint.name}`, async () => {
          await this.runWebpack(
            await this.getPreloadRendererConfig(entryPoint, entryPoint.preload!),
          );
        });
      }
    }
  }

  launchDevServers = async (logger: Logger) => {
    await asyncOra('Launch Dev Servers', async () => {
      const tab = logger.createTab('Renderers');

      const config = await this.getRendererConfig(this.config.renderer.entryPoints);
      const compiler = webpack(config);
      const server = webpackDevMiddleware(compiler, {
        logger: {
          debug: tab.log.bind(tab),
          log: tab.log.bind(tab),
          info: tab.log.bind(tab),
          error: tab.log.bind(tab),
          warn: tab.log.bind(tab),
        },
        publicPath: '/',
        hot: true,
        historyApiFallback: true,
        writeToDisk: true,
      } as any);
      const app = express();
      app.use(server);
      app.use(webpackHotMiddleware(compiler));
      this.servers.push(app.listen(this.port));
    });

    await asyncOra('Compiling Preload Scripts', async () => {
      for (const entryPoint of this.config.renderer.entryPoints) {
        if (entryPoint.preload) {
          const config = await this.getPreloadRendererConfig(
            entryPoint,
            entryPoint.preload!,
          );
          await new Promise((resolve, reject) => {
            const tab = logger.createTab(`${entryPoint.name} - Preload`);
            const [onceResolve, onceReject] = once(resolve, reject);

            this.watchers.push(webpack(config).watch({}, (err, stats) => {
              if (stats) {
                tab.log(stats.toString({
                  colors: true,
                }));
              }

              if (err) return onceReject(err);
              return onceResolve();
            }));
          });
        }
      }
    });
  }

  private alreadyStarted = false;

  async startLogic(): Promise<false> {
    if (this.alreadyStarted) return false;
    this.alreadyStarted = true;

    await fs.remove(this.baseDir);

    const logger = new Logger(this.loggerPort);
    this.loggers.push(logger);
    await this.compileMain(true, logger);
    await this.launchDevServers(logger);
    await logger.start();
    return false;
  }
}
