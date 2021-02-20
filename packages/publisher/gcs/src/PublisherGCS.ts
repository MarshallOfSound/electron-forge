import PublisherBase, { PublisherOptions } from '@electron-forge/publisher-base';
import { asyncOra } from '@electron-forge/async-ora';

import debug from 'debug';
import path from 'path';
import { Storage } from '@google-cloud/storage';

import { PublisherGCSConfig } from './Config';

const d = debug('electron-forge:publish:gcs');

type GCSArtifact = {
  path: string;
  keyPrefix: string;
  platform: string;
  arch: string;
};

export default class PublisherGCS extends PublisherBase<PublisherGCSConfig> {
  name = 'gcs';

  async publish({
    makeResults,
  }: PublisherOptions) {
    const { config } = this;
    const artifacts: GCSArtifact[] = [];

    for (const makeResult of makeResults) {
      artifacts.push(...makeResult.artifacts.map((artifact) => ({
        path: artifact,
        keyPrefix: config.folder || makeResult.packageJSON.version,
        platform: makeResult.platform,
        arch: makeResult.arch,
      })));
    }

    const clientEmail = config.clientEmail || process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
    const privateKey = config.privateKey || process.env.GOOGLE_CLOUD_PRIVATE_KEY;

    let credentials;
    if (clientEmail && privateKey) {
      credentials = {
        client_email: clientEmail,
        private_key: privateKey,
      };
    }

    const storage = new Storage({
      keyFilename: config.projectId || process.env.GOOGLE_APPLICATION_CREDENTIALS,
      credentials,
      projectId: config.projectId || process.env.GOOGLE_CLOUD_PROJECT,
    });

    if (!config.bucket) {
      throw new Error('In order to publish to Google Cloud Storage you must set the "gcs.bucket" property in your Forge config.');
    }
    const bucket = storage.bucket(config.bucket);

    d('creating Google Cloud Storage client with options:', config);

    let uploaded = 0;
    const spinnerText = () => `Uploading Artifacts ${uploaded}/${artifacts.length}`;

    await asyncOra(spinnerText(), async (uploadSpinner) => {
      await Promise.all(artifacts.map(async (artifact) => {
        d('uploading:', artifact.path);

        await bucket.upload(artifact.path, {
          gzip: true,
          destination: this.keyForArtifact(artifact),
          public: config.public,
        });

        uploaded += 1;
        uploadSpinner.text = spinnerText();
      }));
    });
  }

  keyForArtifact(artifact: GCSArtifact): string {
    if (this.config.keyResolver) {
      return this.config.keyResolver(
        path.basename(artifact.path),
        artifact.platform,
        artifact.arch,
      );
    }

    return `${artifact.keyPrefix}/${path.basename(artifact.path)}`;
  }
}
