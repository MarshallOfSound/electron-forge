import { Octokit } from '@octokit/rest';

export default class GitHub {
  private options: Octokit.Options;

  token?: string;

  constructor(
    authToken: string | undefined = undefined,
    requireAuth: boolean = false,
    options: Octokit.Options = {},
  ) {
    this.options = {
      ...options,
      ...{ userAgent: 'Electron Forge' },
    };
    if (authToken) {
      this.token = authToken;
    } else if (process.env.GITHUB_TOKEN) {
      this.token = process.env.GITHUB_TOKEN;
    } else if (requireAuth) {
      throw new Error('Please set GITHUB_TOKEN in your environment to access these features');
    }
  }

  getGitHub() {
    const authOption = this.token ? { auth: `token ${this.token}` } : {};
    const github = new Octokit({
      ...this.options,
      ...authOption,
    });
    return github;
  }
}
