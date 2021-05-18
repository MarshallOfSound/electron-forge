import { Configuration, ConfigurationFactory } from 'webpack';

const trivialConfigurationFactory = (config: Configuration): ConfigurationFactory => () => config;

export type ConfigProcessor = (config: ConfigurationFactory) => Promise<Configuration>;

// Ensure processing logic is run for both `Configuration` and
// `ConfigurationFactory` config variants.
const processConfig = async (
  processor: ConfigProcessor,
  config: Configuration | ConfigurationFactory,
): Promise<Configuration> => {
  const configFactory = (typeof config === 'function') ? config : trivialConfigurationFactory(config);
  return processor(configFactory);
};

export default processConfig;
