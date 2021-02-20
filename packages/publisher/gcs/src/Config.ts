export interface PublisherGCSConfig {
  /**
   * The path to the file that is either:
   * - the JSON file that contains your Google service account credentials, or
   * - the PEM/PKCS #12-formatted file that contains the private key.
   *
   * Defaults to the value in the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.
   */
  keyFilename?: string;
  /**
   * The Google Cloud project ID.
   *
   * Defaults to the value in the `GOOGLE_CLOUD_PROJECT` environment variable.
   * */
  projectId?: string,
  /**
   * The email for your Google service account, *required* when using a PEM/PKCS #12-formatted
   * file in the [[keyFilename]] option.
   *
   * Defaults to the value in the `GOOGLE_CLOUD_CLIENT_EMAIL` environment variable.
   */
  clientEmail?: string;
  /**
   * The private key for your Google service account.
   *
   * Defaults to the value in the `GOOGLE_CLOUD_PRIVATE_KEY` environment variable.
   */
  privateKey?: string;
  /**
   * The name of the Google Cloud Storage bucket where artifacts are uploaded.
   */
  bucket?: string;
  /**
   * The key prefix where artifacts are uploaded, e.g., `my/prefix`.
   *
   * Defaults to the application `version` specified in the app's `package.json`.
   */
  folder?: string;
  /**
   * Whether to make uploaded artifacts public to the internet.
   *
   * Defaults to `false`.
   */
  public?: boolean;
  /**
   * Custom function to provide the key to upload a given file to
   */
  keyResolver?: (fileName: string, platform: string, arch: string) => string;
}
