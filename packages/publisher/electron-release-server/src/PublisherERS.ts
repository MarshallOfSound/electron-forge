import PublisherBase, { PublisherOptions } from '@electron-forge/publisher-base';
import { asyncOra } from '@electron-forge/async-ora';
import { ForgePlatform, ForgeArch } from '@electron-forge/shared-types';

import debug from 'debug';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs-extra';
import path from 'path';

import { PublisherERSConfig } from './Config';

const d = debug('electron-forge:publish:ers');

interface ERSVersion {
  name: string;
  assets: { name: string; }[];
}

const fetchAndCheckStatus = async (
  url: RequestInfo,
  init?: RequestInit,
): Promise<Response> => {
  const result = await fetch(url, init);
  if (result.ok) { // res.status >= 200 && res.status < 300
    return result;
  }
  throw new Error(`ERS publish failed with status code: ${result.status} (${result.url})`);
};

export const ersPlatform = (platform: ForgePlatform, arch: ForgeArch) => {
  switch (platform) {
    case 'darwin':
      return 'osx_64';
    case 'linux':
      return arch === 'ia32' ? 'linux_32' : 'linux_64';
    case 'win32':
      return arch === 'ia32' ? 'windows_32' : 'windows_64';
    default:
      return platform;
  }
};

export default class PublisherERS extends PublisherBase<PublisherERSConfig> {
  name = 'electron-release-server';

  async publish({ makeResults }: PublisherOptions) {
    const { config } = this;

    if (!(config.baseUrl && config.username && config.password)) {
      throw new Error('In order to publish to ERS you must set the "electronReleaseServer.baseUrl", "electronReleaseServer.username" and "electronReleaseServer.password" properties in your Forge config. See the docs for more info');
    }

    d('attempting to authenticate to ERS');

    const api = (apiPath: string) => `${config.baseUrl}/${apiPath}`;

    const { token } = await (await fetchAndCheckStatus(api('api/auth/login'), {
      method: 'POST',
      body: JSON.stringify({
        username: config.username,
        password: config.password,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })).json();

    // eslint-disable-next-line max-len
    const authFetch = (apiPath: string, options?: any) => fetchAndCheckStatus(api(apiPath), { ...options || {}, headers: { ...(options || {}).headers, Authorization: `Bearer ${token}` } });

    const versions: ERSVersion[] = await (await authFetch('api/version')).json();

    for (const makeResult of makeResults) {
      const { packageJSON } = makeResult;
      const artifacts = makeResult.artifacts
        .filter((artifactPath) => path.basename(artifactPath).toLowerCase() !== 'releases');

      const existingVersion = versions.find((version) => version.name === packageJSON.version);

      let channel = 'stable';
      if (config.channel) {
        // eslint-disable-next-line prefer-destructuring
        channel = config.channel;
      } else if (packageJSON.version.includes('beta')) {
        channel = 'beta';
      } else if (packageJSON.version.includes('alpha')) {
        channel = 'alpha';
      }

      if (!existingVersion) {
        await authFetch('api/version', {
          method: 'POST',
          body: JSON.stringify({
            channel: {
              name: channel,
            },
            name: packageJSON.version,
            notes: '',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      let uploaded = 0;
      const getText = () => `Uploading Artifacts ${uploaded}/${artifacts.length}`;

      await asyncOra(getText(), async (uploadSpinner) => {
        const updateSpinner = () => {
          uploadSpinner.text = getText();
        };

        await Promise.all(artifacts.map(async (artifactPath) => {
          if (existingVersion) {
            const existingAsset = existingVersion.assets.find(
              (asset) => asset.name === path.basename(artifactPath),
            );

            if (existingAsset) {
              d('asset at path:', artifactPath, 'already exists on server');
              uploaded += 1;
              updateSpinner();
              return;
            }
          }
          d('attempting to upload asset:', artifactPath);
          const artifactForm = new FormData();
          artifactForm.append('token', token);
          artifactForm.append('version', packageJSON.version);
          artifactForm.append('platform', ersPlatform(makeResult.platform, makeResult.arch));
          artifactForm.append('file', fs.createReadStream(artifactPath));
          await authFetch('api/asset', {
            method: 'POST',
            body: artifactForm,
            headers: artifactForm.getHeaders(),
          });
          d('upload successful for asset:', artifactPath);
          uploaded += 1;
          updateSpinner();
        }));
      });
    }
  }
}
