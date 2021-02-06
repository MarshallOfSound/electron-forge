import debug from 'debug';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import webpack, { Configuration } from 'webpack';
import { merge as webpackMerge } from 'webpack-merge';

import { WebpackPluginConfig, WebpackPluginEntryPoint, WebpackPreloadEntryPoint } from './Config';

type EntryType = string | string[] | Record<string, string | string[]>;

const d = debug('electron-forge:plugin:webpack:webpackconfig');

export default class WebpackConfigGenerator {
  private isProd: boolean;

  private pluginConfig: WebpackPluginConfig;

  private port: number;

  private projectDir: string;

  private webpackDir: string;

  constructor(
    pluginConfig: WebpackPluginConfig,
    projectDir: string,
    isProd: boolean,
    port: number,
  ) {
    this.pluginConfig = pluginConfig;
    this.projectDir = projectDir;
    this.webpackDir = path.resolve(projectDir, '.webpack');
    this.isProd = isProd;
    this.port = port;

    d('Config mode:', this.mode);
  }

  resolveConfig(config: Configuration | string) {
    if (typeof config === 'string') {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(path.resolve(this.projectDir, config)) as Configuration;
    }

    return config;
  }

  get mode() {
    return this.isProd ? 'production' : 'development';
  }

  rendererEntryPoint(
    entryPoint: WebpackPluginEntryPoint,
    inRendererDir: boolean,
    basename: string,
  ): string {
    if (this.isProd) {
      return `\`file://$\{require('path').resolve(__dirname, '..', '${inRendererDir ? 'renderer' : '.'}', '${entryPoint.name}', '${basename}')}\``;
    }
    const baseUrl = `http://localhost:${this.port}/${entryPoint.name}`;
    if (basename !== 'index.html') {
      return `'${baseUrl}/${basename}'`;
    }
    return `'${baseUrl}'`;
  }

  toEnvironmentVariable(entryPoint: WebpackPluginEntryPoint, preload = false): string {
    const suffix = preload ? '_PRELOAD_WEBPACK_ENTRY' : '_WEBPACK_ENTRY';
    return `${entryPoint.name.toUpperCase().replace(/ /g, '_')}${suffix}`;
  }

  getPreloadDefine(entryPoint: WebpackPluginEntryPoint): string {
    if (entryPoint.preload) {
      if (this.isProd) {
        return `require('path').resolve(__dirname, '../renderer', '${entryPoint.name}', 'preload.js')`;
      }
      return `'${path.resolve(this.webpackDir, 'renderer', entryPoint.name, 'preload.js').replace(/\\/g, '\\\\')}'`;
    }
    // If this entry-point has no configured preload script just map this constant to `undefined`
    // so that any code using it still works.  This makes quick-start / docs simpler.
    return 'undefined';
  }

  assetRelocatorBaseDir(inRendererDir = true) {
    if (this.isProd) {
      return `process.resourcesPath + "/" + (__filename.includes(".asar") ? "app.asar" : "app") + "/.webpack/${inRendererDir ? 'main' : 'renderer/any_folder'}"`;
    }

    return JSON.stringify(
      path.resolve(
        this.webpackDir,
        inRendererDir ? 'main' : 'renderer',
        inRendererDir ? '.' : 'any_folder',
      ),
    );
  }

  getDefines(inRendererDir = true) {
    const defines: { [key: string]: string; } = {
      ASSET_RELOCATOR_BASE_DIR: this.assetRelocatorBaseDir(inRendererDir),
    };
    if (
      !this.pluginConfig.renderer.entryPoints
      || !Array.isArray(this.pluginConfig.renderer.entryPoints)
    ) {
      throw new Error('Required config option "renderer.entryPoints" has not been defined');
    }
    for (const entryPoint of this.pluginConfig.renderer.entryPoints) {
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

  getMainConfig() {
    const mainConfig = this.resolveConfig(this.pluginConfig.mainConfig);

    if (!mainConfig.entry) {
      throw new Error('Required option "mainConfig.entry" has not been defined');
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

    return webpackMerge({
      devtool: 'source-map',
      target: 'electron-main',
      mode: this.mode,
      output: {
        path: path.resolve(this.webpackDir, 'main'),
        filename: 'index.js',
        libraryTarget: 'commonjs2',
      },
      plugins: [
        new webpack.DefinePlugin(this.getDefines()),
      ],
      node: {
        __dirname: false,
        __filename: false,
      },
    }, mainConfig || {});
  }

  async getPreloadRendererConfig(
    parentPoint: WebpackPluginEntryPoint,
    entryPoint: WebpackPreloadEntryPoint,
  ) {
    const rendererConfig = this.resolveConfig(this.pluginConfig.renderer.config);
    const prefixedEntries = entryPoint.prefixedEntries || [];

    return webpackMerge({
      devtool: 'inline-source-map',
      mode: this.mode,
      entry: prefixedEntries.concat([
        entryPoint.js,
      ]),
      output: {
        path: path.resolve(this.webpackDir, 'renderer', parentPoint.name),
        filename: 'preload.js',
      },
      node: {
        __dirname: false,
        __filename: false,
      },
    },
    rendererConfig || {},
    { target: 'electron-preload' });
  }

  async getRendererConfig(entryPoints: WebpackPluginEntryPoint[]) {
    const rendererConfig = this.resolveConfig(this.pluginConfig.renderer.config);
    const entry: webpack.Entry = {};
    for (const entryPoint of entryPoints) {
      const prefixedEntries = entryPoint.prefixedEntries || [];
      entry[entryPoint.name] = prefixedEntries
        .concat([entryPoint.js])
        .concat(this.isProd || !entryPoint.html ? [] : ['webpack-hot-middleware/client']);
    }

    const defines = this.getDefines(false);
    const plugins = entryPoints.filter((entryPoint) => Boolean(entryPoint.html))
      .map((entryPoint) => new HtmlWebpackPlugin({
        title: entryPoint.name,
        template: entryPoint.html,
        filename: `${entryPoint.name}/index.html`,
        chunks: [entryPoint.name].concat(entryPoint.additionalChunks || []),
      }) as webpack.Plugin).concat([new webpack.DefinePlugin(defines)])
      .concat(this.isProd ? [] : [new webpack.HotModuleReplacementPlugin()]);
    return webpackMerge({
      entry,
      devtool: 'inline-source-map',
      target: 'electron-renderer',
      mode: this.mode,
      output: {
        path: path.resolve(this.webpackDir, 'renderer'),
        filename: '[name]/index.js',
        globalObject: 'self',
        ...(this.isProd ? {} : { publicPath: '/' }),
      },
      node: {
        __dirname: false,
        __filename: false,
      },
      plugins,
    }, rendererConfig || {});
  }
}
