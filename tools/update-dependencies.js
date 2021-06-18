#!/usr/bin/env node

const globby = require('globby')
const { satisfies } = require('semver')
const { spawn } = require('@malept/cross-spawn-promise')

const DO_NOT_UPGRADE = [
  '@typescript-eslint/eslint-plugin', // special case
  'commander', // TODO: convert to yargs
  'log-symbols', // Requires the entire project to convert to ESM
  'typescript' // Promisify issues, see https://github.com/DefinitelyTyped/DefinitelyTyped/pull/49699
]

/**
 * Spawn, but pass through stdio by default.
 */
async function spawnPassthrough(cmd, args, options) {
  await spawn(cmd, args, { stdio: 'inherit', ...options })
}

async function git(...args) {
  await spawnPassthrough('git', args)
}

async function yarn(...args) {
  await spawnPassthrough('yarn', args)
}


class Package {
  constructor(name, currentVersion, wantedVersion, latestVersion, type) {
    this.name = name
    this.currentVersion = currentVersion
    this.wantedVersion = wantedVersion
    this.latestVersion = latestVersion
    this.type = type
  }

  get commitType() {
    switch (this.type) {
      case 'dependencies':
      case 'optionalDependencies':
        return 'deps'
      case 'devDependencies':
        return 'deps-dev'
      default:
        return 'deps-unknown'
    }
  }

  get commitVersion() {
    if (this.isMajorVersionBump()) {
      return `^${this.latestVersion}`
    } else {
      return this.latestVersion
    }
  }

  isMajorVersionBump() {
    return !satisfies(this.latestVersion, `^${this.wantedVersion}`)
  }

  async smoketestAndCommit(packageName = null) {
    const packageJSONs = await globby('packages/*/*/package.json')
    await yarn('lint')
    await yarn('build')
    await git('add', 'package.json', 'yarn.lock', ...packageJSONs)
    await git('commit', '-m', `build(${this.commitType}): upgrade ${packageName || this.name} to ${this.commitVersion}`)
  }

  async upgrade() {
    if (this.isMajorVersionBump()) {
      await this.major_upgrade()
    } else {
      await this.nonmajor_upgrade()
    }
  }

  async major_upgrade() {
    console.log(`Upgrading ${this.name} from ${this.wantedVersion} to ^${this.latestVersion} (and updating package.json)...`)
    await yarn('upgrade', `${this.name}@^${this.latestVersion}`)
  }

  async nonmajor_upgrade() {
    console.log(`Upgrading ${this.name} from ${this.currentVersion} to ${this.latestVersion} in yarn.lock...`)
    await yarn('upgrade', this.name)
  }
}

async function main() {
  try {
    await spawn('yarn', ['outdated', '--json'])
    console.log('No packages to update.')
  } catch (error) {
    const table = JSON.parse(error.stdout.split('\n')[1])
    for (const [packageName, currentVersion, wantedVersion, latestVersion, packageType, _url] of table.data.body) {
      if (DO_NOT_UPGRADE.includes(packageName)) {
        continue
      }
      let commitPackageName = null
      const package = new Package(packageName, currentVersion, wantedVersion, latestVersion, packageType)
      await package.upgrade()

      if (packageName === '@typescript-eslint/parser') {
        const eslintPlugin = new Package('@typescript-eslint/eslint-plugin', currentVersion, wantedVersion, latestVersion, packageType)
        await eslintPlugin.upgrade()
        commitPackageName = '@typescript-eslint/{parser,eslint-plugin}'
      }

      await package.smoketestAndCommit(commitPackageName)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
