import { Configuration as WebpackConfiguration } from 'webpack';

export interface WebpackPluginEntryPoint {
  /**
   * Relative or absolute path to the HTML template file for this entry point
   *
   * If this is a window, you MUST provide this.  Only leave it unset for things
   * like WebWorker scripts.
   */
  html?: string;
  /**
   * Relative or absolute path to the main JS file for this entry point
   */
  js: string;
  /**
   * Human friendly name of your entry point
   */
  name: string;
  /**
   * Additional entries to put in the array of entries for this entry point,
   * useful if you need to set up things like error reporting as separate
   * entry files into your application.
   */
  prefixedEntries?: string[];
  /**
   * Additional chunks to include in the outputted HTML file, use this if you
   * set up some custom chunking.  E.g. CommonChunksPlugin
   */
  additionalChunks?: string[];
  /**
   * Information about the preload script for this entry point, if you don't use
   * preload scripts you don't need to set this.
   */
  preload?: WebpackPreloadEntryPoint;
}

export interface WebpackPreloadEntryPoint {
  /**
   * Relative or absolute path to the preload JS file
   */
  js: string;
  /**
   * Additional entries to put in the array of entries for this preload script,
   * useful if you need to set up things like error reporting as separate
   * entry files into your application.
   */
  prefixedEntries?: string[];
}

export interface WebpackPluginRendererConfig {
  /**
   * The webpack config for your renderer process
   */
  config: WebpackConfiguration | string;

  /**
   * The webpack config for your preload script - this is optional.
   */
  preloadConfig?: WebpackConfiguration | string;

  /**
   * Instructs webpack to emit a JSON file containing statistics about modules, the dependency
   * graph, and various other build information for the renderer process during the app
   * packaging process. This file is located in `.webpack/renderer/stats.json`, but is not
   * actually packaged with your app.
   */
  jsonStats?: boolean;
  /**
   * Adjusts the Webpack config for the renderer based on whether `nodeIntegration` for the
   * `BrowserWindow` is enabled. Namely, for Webpack's `target` option:
   *
   * * When `nodeIntegration` is true, the `target` is `electron-renderer`.
   * * When `nodeIntegration` is false, the `target` is `web`.
   *
   * Unfortunately, we cannot derive the value from the main process code as it can be a
   * dynamically generated value at runtime, and Webpack processes at build-time.
   *
   * Defaults to `false` (as it is disabled by default in Electron >= 5).
   */
  nodeIntegration?: boolean;
  /**
   * Array of entry points, these should map to the windows your app needs to
   * open.  Each window requires it's own entry point
   */
  entryPoints: WebpackPluginEntryPoint[];
}

export interface WebpackPluginConfig {
  /**
   * The webpack config for your main process
   */
  mainConfig: WebpackConfiguration | string;
  /**
   * Instructs webpack to emit a JSON file containing statistics about modules, the dependency
   * graph, and various other build information for the main process. This file is located in
   * `.webpack/main/stats.json`, but is not packaged with your app.
   */
  jsonStats?: boolean;
  /**
   * Electron Forge webpack configuration for your renderer process
   */
  renderer: WebpackPluginRendererConfig;
  /**
   * The TCP port for the dev servers. Defaults to 3000.
   */
  port?: number;
  /**
   * The TCP port for web-multi-logger. Defaults to 9000.
   */
  loggerPort?: number;
  /**
   * Sets the [`Content-Security-Policy` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
   * for the Webpack development server.
   *
   * Normally you would want to only specify this as a `<meta>` tag. However, in development mode,
   * the Webpack plugin uses the `devtool: eval-source-map` source map setting for efficiency
   * purposes. This requires the `'unsafe-eval'` source for the `script-src` directive that wouldn't
   * normally be recommended to use. If this value is set, make sure that you keep this
   * directive-source pair intact if you want to use source maps.
   *
   * Default: `default-src 'self' 'unsafe-inline' data:;`
   * `script-src 'self' 'unsafe-eval' 'unsafe-inline' data:`
   */
  devContentSecurityPolicy?: string
}
