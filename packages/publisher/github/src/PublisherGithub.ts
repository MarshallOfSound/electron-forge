import { asyncOra } from '@electron-forge/async-ora';
import { ForgeMakeResult } from '@electron-forge/shared-types';
import fs from 'fs-extra';
import mime from 'mime-types';
import PublisherBase, { PublisherOptions } from '@electron-forge/publisher-base';
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';

import GitHub from './util/github';
import { PublisherGitHubConfig } from './Config';

interface GitHubRelease {
  // eslint-disable-next-line camelcase
  tag_name: string;
  assets: {
    name: string;
  }[];
  // eslint-disable-next-line camelcase
  upload_url: string;
}

export default class PublisherGithub extends PublisherBase<PublisherGitHubConfig> {
  name = 'github';

  async publish({ makeResults }: PublisherOptions) {
    const { config } = this;

    const perReleaseArtifacts: {
      [release: string]: ForgeMakeResult[];
    } = {};

    for (const makeResult of makeResults) {
      const release = makeResult.packageJSON.version;
      if (!perReleaseArtifacts[release]) {
        perReleaseArtifacts[release] = [];
      }
      perReleaseArtifacts[release].push(makeResult);
    }

    if (!(config.repository && typeof config.repository === 'object'
      && config.repository.owner && config.repository.name)) {
      throw new Error('In order to publish to github you must set the "github_repository.owner" and "github_repository.name" properties in your Forge config. See the docs for more info');
    }

    const github = new GitHub(config.authToken, true, config.octokitOptions);

    const octokit = github.getGitHub();
    type OctokitRelease = GetResponseDataTypeFromEndpointMethod<typeof octokit.repos.getRelease>;
    type OctokitReleaseAsset = GetResponseDataTypeFromEndpointMethod<
      typeof octokit.repos.updateReleaseAsset
    >;

    for (const releaseName of Object.keys(perReleaseArtifacts)) {
      let release: OctokitRelease | undefined;
      const artifacts = perReleaseArtifacts[releaseName];

      await asyncOra(`Searching for target release: ${releaseName}`, async () => {
        try {
          release = (await github.getGitHub().repos.listReleases({
            owner: config.repository.owner,
            repo: config.repository.name,
            per_page: 100,
          })).data.find((testRelease: GitHubRelease) => testRelease.tag_name === `v${releaseName}`);
          if (!release) {
            // eslint-disable-next-line no-throw-literal
            throw { code: 404 };
          }
        } catch (err) {
          if (err.code === 404) {
            // Release does not exist, let's make it
            release = (await github.getGitHub().repos.createRelease({
              owner: config.repository.owner,
              repo: config.repository.name,
              tag_name: `v${releaseName}`,
              name: `v${releaseName}`,
              draft: config.draft !== false,
              prerelease: config.prerelease === true,
            })).data;
          } else {
            // Unknown error
            throw err;
          }
        }
      });

      let uploaded = 0;
      await asyncOra(`Uploading Artifacts ${uploaded}/${artifacts.length} to v${releaseName}`, async (uploadSpinner) => {
        const updateSpinner = () => {
          uploadSpinner.text = `Uploading Artifacts ${uploaded}/${artifacts.length} to v${releaseName}`;
        };

        const flatArtifacts: string[] = [];
        for (const artifact of artifacts) {
          flatArtifacts.push(...artifact.artifacts);
        }

        await Promise.all(flatArtifacts.map(async (artifactPath) => {
          const done = () => {
            uploaded += 1;
            updateSpinner();
          };
          const artifactName = GitHub.sanitizeName(artifactPath);
          // eslint-disable-next-line max-len
          const asset = release!.assets.find((item: OctokitReleaseAsset) => item.name === artifactName);
          if (asset !== undefined) {
            if (config.override === true) {
              await github.getGitHub().repos.deleteReleaseAsset({
                owner: config.repository.owner,
                repo: config.repository.name,
                asset_id: asset.id,
              });
            } else {
              return done();
            }
          }

          await github.getGitHub().repos.uploadReleaseAsset({
            owner: config.repository.owner,
            repo: config.repository.name,
            release_id: release!.id,
            url: release!.upload_url,
            // https://github.com/octokit/rest.js/issues/1645
            data: ((await fs.readFile(artifactPath)) as unknown) as string,
            headers: {
              'content-type': mime.lookup(artifactPath) || 'application/octet-stream',
              'content-length': (await fs.stat(artifactPath)).size,
            },
            name: artifactName,
          });
          return done();
        }));
      });
    }
  }
}
