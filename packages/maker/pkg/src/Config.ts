// eslint-disable-next-line import/prefer-default-export
export interface MakerPKGConfig {
  /**
   * The name to the output the flattened package.
   *
   * Default: `${appName}-${packageJSON.version}.pkg`
   */
  name?: string;
  /**
   * Name of certificate to use when signing.
   *
   * Default to be selected with respect to platform from keychain or keychain
   * by system default.
   */
  identity?: string;
  /**
   * Flag to enable/disable validation for signing identity. If enabled, the
   * identity provided will be validated in the keychain specified.
   *
   * Default: `true`.
   */
  'identity-validation'?: boolean;
  /**
   * Path to install the bundle. Default to `/Applications`.
   */
  install?: string;
  /**
   * The keychain name.
   *
   * Default: System default keychain.
   */
  keychain?: string;
  /**
   * Path to a directory containing pre and/or post install scripts
   */
  scripts?: string;
}
