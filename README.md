Electron Forge
--------------
[![Linux/macOS Build Status](https://travis-ci.org/electron-userland/electron-forge.svg?branch=master)](https://travis-ci.org/electron-userland/electron-forge)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/79ae80nek1eucyy3?svg=true)](https://ci.appveyor.com/project/electron-userland/electron-forge)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/electron-forge.svg)](https://www.npmjs.com/package/electron-forge)
[![npm](https://img.shields.io/npm/dt/electron-forge.svg?maxAge=2592000)](https://www.npmjs.com/package/electron-forge)
[![license](https://img.shields.io/github/license/electron-userland/electron-forge.svg)](https://github.com/electron-userland/electron-forge/blob/master/LICENSE)
![status](https://img.shields.io/badge/Status-%20Ready%20for%20Awesome-red.svg)

A complete tool for building modern Electron applications.

Electron Forge unifies the existing (and well maintained) build tools for
Electron development into a simple, easy to use package so that anyone can
jump right in to Electron development.

----

[Website](https://v6.electronforge.io) |
[Goals](#project-goals) |
[Docs and Usage](#docs-and-usage) |
[Configuration](https://v6.electronforge.io/configuration) |
[Support](https://github.com/electron-userland/electron-forge/blob/master/SUPPORT.md) |
[Contributing](https://github.com/electron-userland/electron-forge/blob/master/CONTRIBUTING.md) |
[Changelog](https://github.com/electron-userland/electron-forge/blob/master/CHANGELOG.md)

# Getting Started

**Note**: Electron Forge requires Node 6 or above, plus git installed.

```bash
npm install -g @electron-forge/cli@beta
electron-forge init my-new-app
cd my-new-app
npm start
```

Alternatively, if you have a more recent version of `npm` or `yarn`, you can use
[`npx`](https://medium.com/@maybekatz/introducing-npx-an-npm-package-runner-55f7d4bd282b),
or
[`yarn create`](https://yarnpkg.com/blog/2017/05/12/introducing-yarn/).

```bash
npx create-electron-app my-new-app
# or
yarn create electron-app my-new-app

# then
cd my-new-app
npm start
```

# Project Goals

1. Starting with Electron should be as simple as a single command.
2. Developers shouldn't have to worry about setting up build tooling,
   native module rebuilding, etc.  Everything should "just work" for them out
   of the box.
3. Everything from creating the project to packaging the project for release
   should be handled by one core dependency in a standard way while still offering
   users maximum choice and freedom.

With these goals in mind, under the hood this project uses, among others:

* [`electron-rebuild`](https://github.com/electron/electron-rebuild):
  Automatically recompiles native Node.js modules against the correct
  Electron version.
* [Electron Packager](https://github.com/electron-userland/electron-packager):
  Customizes and bundles your Electron app to get it ready for distribution.

# Docs and Usage

For Electron Forge documentation and usage you should check out our website:
[electronforge.io](https://v6.electronforge.io)

# FAQ

## How do I use this with `webpack`/`babel`/`typescript`/`random build tool`?

As of Electron Forge 6+ by default we only do vanilla JavaScript but if you want
to do some fancy build tool stuff you should check out the [plugins](https://v6.electronforge.io/plugins)
section of our docs site.  We currently have plugins for Webpack, Parcel and
Electron Compile.

# Contributing

Getting the code base running locally requires the `bolt` command installed globally.  An example is given below.

```bash
npm i -g bolt
git clone https://github.com/electron-userland/electron-forge
cd electron-forge
# Installs all dependencies, don't run "yarn" or "npm install" yourself
bolt
# Builds all the TS code
bolt build
```

**NOTE:** Please ensure that all changes are committed using semantic commits, we expose a helper `bolt commit`
to make this easier.

For more information you should check out our [Contributing](CONTRIBUTING.md) guide.

# Team

| <img src="https://s.gravatar.com/avatar/1576c987b53868acf73d6ccb08110a78?s=144" width="144" /> | <img src="https://avatars2.githubusercontent.com/u/11417?s=460&v=4" width="144" /> |
|---| --- |
| [Samuel Attard](https://samuelattard.com) | [Mark Lee](https://github.com/malept) |
