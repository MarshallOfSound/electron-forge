import webpack from 'webpack';
import { Walker, DepType } from 'flora-colossus';
import * as path from 'path';

const IGNORED_MODULES = ['electron'];

// eslint-disable-next-line import/prefer-default-export
export function getExternalsFromConfig(config: webpack.Configuration): string[] {
  const modules: string[] = [];

  if (config.externals) {
    if (Array.isArray(config.externals)) {
      for (const external of config.externals) {
        if (typeof external === 'string') {
          modules.push(external);
        }
      }

      return modules;
    }

    if (typeof config.externals === 'object') {
      return Object.keys(config.externals);
    }
  }

  return [];
}

async function getDependenciesForModule(rootDir: string, mod: string): Promise<string[]> {
  if (IGNORED_MODULES.includes(mod)) {
    return [];
  }

  try {
    const moduleRoot = path.dirname(
      require.resolve(`${mod}/package.json`, { paths: [rootDir] }),
    );

    const walker = new Walker(moduleRoot) as any;

    // These are private so it's quite nasty for now!
    walker.modules = [];
    await walker.walkDependenciesForModule(moduleRoot, DepType.PROD);
    return walker.modules.map((dep: { name: string }) => dep.name);
  } catch (_) {
    return [];
  }
}

export async function getDependenciesForModules(
  rootDir: string,
  modules: string[],
): Promise<string[]> {
  const dependencies = await Promise.all(
    modules.map((mod) => getDependenciesForModule(rootDir, mod)),
  );

  return Array.from(new Set(modules.concat(...dependencies)));
}
