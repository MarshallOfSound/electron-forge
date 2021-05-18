import { expect } from 'chai';
import { ConfigurationFactory } from 'webpack';
import processConfig, { ConfigProcessor } from '../../src/util/processConfig';

const sampleWebpackConfig = {
  module: {
    rules: [{
      test: /\.(png|jpg|gif|webp)$/,
      use: 'file-loader',
    }],
  },
};

const sampleConfigFactoryParams: Parameters<ConfigurationFactory> = [{}, { mode: 'production' }];

describe('processConfig', () => {
  it('works for object config', async () => {
    let invoked = 0;
    const processor: ConfigProcessor = async (configFactory) => {
      invoked += 1;
      return configFactory(sampleConfigFactoryParams[0], sampleConfigFactoryParams[1]);
    };

    expect(await processConfig(processor, sampleWebpackConfig)).to.deep.equal(sampleWebpackConfig);
    expect(invoked).to.equal(1);
  });

  it('works for fn config', async () => {
    let invoked = 0;
    const processor: ConfigProcessor = async (configFactory) => {
      invoked += 1;
      return configFactory(sampleConfigFactoryParams[0], sampleConfigFactoryParams[1]);
    };

    const fnConfig: ConfigurationFactory = async (arg0, arg1) => {
      expect(arg0).to.be.equal(sampleConfigFactoryParams[0]);
      expect(arg1).to.be.equal(sampleConfigFactoryParams[1]);
      return sampleWebpackConfig;
    };

    expect(await processConfig(processor, fnConfig)).to.deep.equal(sampleWebpackConfig);
    expect(invoked).to.equal(1);
  });

  it('works for promise config', async () => {
    let invoked = 0;
    const processor: ConfigProcessor = async (configFactory) => {
      invoked += 1;
      return configFactory(sampleConfigFactoryParams[0], sampleConfigFactoryParams[1]);
    };

    const promiseConfig: ConfigurationFactory = async (arg0, arg1) => {
      expect(arg0).to.be.equal(sampleConfigFactoryParams[0]);
      expect(arg1).to.be.equal(sampleConfigFactoryParams[1]);
      return sampleWebpackConfig;
    };

    expect(await processConfig(processor, promiseConfig)).to.deep.equal(sampleWebpackConfig);
    expect(invoked).to.equal(1);
  });
});
