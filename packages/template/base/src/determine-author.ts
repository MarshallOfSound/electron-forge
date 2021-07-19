import debug from 'debug';
import { PackagePerson } from '@electron-forge/shared-types';
import { spawn } from '@malept/cross-spawn-promise';
import username from 'username';

const d = debug('electron-forge:determine-author');

async function getGitConfig(name: string, cwd: string): Promise<string> {
  return spawn('git', ['config', '--get', name], { cwd });
}

const getAuthorFromGitConfig = async (dir: string): Promise<PackagePerson> => {
  try {
    const name = await getGitConfig('user.name', dir);
    const email = await getGitConfig('user.email', dir);
    return { name, email };
  } catch (err) {
    d('Error when getting git config:', err);
    return undefined;
  }
};

export default async (dir: string) => (await getAuthorFromGitConfig(dir)) || username();
