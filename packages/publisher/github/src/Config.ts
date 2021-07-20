import { OctokitOptions } from '@octokit/core/dist-types/types.d';

export interface GitHubRepository {
  /**
   * The name of your repository
   */
  name: string;
  /**
   * The owner of your repository, this is either your username or the name of
   * the organization that owns the repository.
   */
  owner: string;
}

export interface PublisherGitHubConfig {
  /**
   * Details that identify your repository (name and owner)
   */
  repository: GitHubRepository;
  /**
   * An authorization token with permission to upload releases to this
   * repository.
   *
   * You can set the GITHUB_TOKEN environment variable if you don't want to hard
   * code this into your config.
   */
  authToken?: string;
  /**
   * This options object is directly passed to @octokit/rest so you can
   * customize any of the options that module uses.  This is particularly
   * helpful for publishing to GitHub Enterprise servers.
   */
  octokitOptions?: OctokitOptions;
  /**
   * Whether or not this release should be tagged as a prerelease
   */
  prerelease?: boolean;
  /**
   * Whether or not this release should be tagged as a draft
   */
  draft?: boolean;
  /**
   * Re-upload the new asset if you upload an asset with the same filename as existing asset
   */
  override?: boolean;
}
