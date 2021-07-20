import PublisherBase, { PublisherOptions } from '@electron-forge/publisher-base';
import { asyncOra } from '@electron-forge/async-ora';

import debug from 'debug';
import fs from 'fs';
import path from 'path';
import S3 from 'aws-sdk/clients/s3';

import { PublisherS3Config } from './Config';

const d = debug('electron-forge:publish:s3');

type S3Artifact = {
  path: string;
  keyPrefix: string;
  platform: string;
  arch: string;
};

export default class PublisherS3 extends PublisherBase<PublisherS3Config> {
  name = 's3';

  async publish({
    makeResults,
  }: PublisherOptions) {
    const { config } = this;
    const artifacts: S3Artifact[] = [];

    for (const makeResult of makeResults) {
      artifacts.push(...makeResult.artifacts.map((artifact) => ({
        path: artifact,
        keyPrefix: config.folder || makeResult.packageJSON.version,
        platform: makeResult.platform,
        arch: makeResult.arch,
      })));
    }

    const s3Client = new S3({
      accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      region: config.region || undefined,
      endpoint: config.endpoint || undefined,
      s3ForcePathStyle: !!config.s3ForcePathStyle,
    });

    if (!config.bucket) {
      throw new Error('In order to publish to s3 you must set the "s3.bucket" property in your Forge config. See the docs for more info');
    }

    d('creating s3 client with options:', config);

    let uploaded = 0;
    const spinnerText = () => `Uploading Artifacts ${uploaded}/${artifacts.length}`;

    await asyncOra(spinnerText(), async (uploadSpinner) => {
      await Promise.all(artifacts.map(async (artifact) => {
        const uploader = s3Client.upload({
          Body: fs.createReadStream(artifact.path),
          Bucket: config.bucket,
          Key: this.keyForArtifact(artifact),
          ACL: config.public ? 'public-read' : 'private',
        } as S3.PutObjectRequest);
        d('uploading:', artifact.path);

        uploader.on('httpUploadProgress', (progress) => {
          const p = `${Math.round((progress.loaded / progress.total) * 100)}%`;
          d(`Upload Progress (${path.basename(artifact.path)}) ${p}`);
        });

        await uploader.promise();
        uploaded += 1;
        uploadSpinner.text = spinnerText();
      }));
    });
  }

  keyForArtifact(artifact: S3Artifact): string {
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
