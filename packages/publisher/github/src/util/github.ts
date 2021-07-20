import { Octokit } from '@octokit/rest';
import { OctokitOptions } from '@octokit/core/dist-types/types.d';
import path from 'path';
import { merge } from 'lodash';

export default class GitHub {
  private options: OctokitOptions;

  token?: string;

  constructor(
    authToken: string | undefined = undefined,
    requireAuth: boolean = false,
    options: OctokitOptions = {},
  ) {
    this.options = merge(
      options,
      { headers: { 'user-agent': 'Electron Forge' } },
    );
    if (authToken) {
      this.token = authToken;
    } else if (process.env.GITHUB_TOKEN) {
      this.token = process.env.GITHUB_TOKEN;
    } else if (requireAuth) {
      throw new Error('Please set GITHUB_TOKEN in your environment to access these features');
    }
  }

  getGitHub(): Octokit {
    const options: OctokitOptions = { ...this.options };
    if (this.token) {
      options.auth = this.token;
    }
    const github = new Octokit(options);
    return github;
  }

  // Based on https://developer.github.com/v3/repos/releases/#upload-a-release-asset and
  // https://stackoverflow.com/questions/59081778/rules-for-special-characters-in-github-repository-name
  static sanitizeName(name: string): string {
    return path.basename(name)
      .replace(/\s/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\./g, '')
      .replace(/\.$/g, '')
      .replace(/[^\w.-]/g, '-');
  }
}
