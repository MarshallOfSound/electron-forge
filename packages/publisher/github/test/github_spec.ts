import { expect } from 'chai';
import proxyquire from 'proxyquire';
import sinon, { SinonSpy } from 'sinon';

import InternalGitHub from '../src/util/github';

describe('GitHub', () => {
  let GitHub: typeof InternalGitHub;
  let gitHubSpy: SinonSpy;
  let MockGitHub: any;

  beforeEach(() => {
    gitHubSpy = sinon.spy();
    MockGitHub = class {
      private options: any;

      constructor(options: any) {
        gitHubSpy();
        this.options = options;
      }
    };
    GitHub = proxyquire.noCallThru().load('../src/util/github', {
      '@octokit/rest': {
        Octokit: MockGitHub,
      },
    }).default;
  });

  it('should read token from constructor', () => {
    expect(new GitHub('token1').token).to.equal('token1');
  });

  it('should fall back to token from environment', () => {
    process.env.GITHUB_TOKEN = 'abc123';
    expect(new GitHub().token).to.equal('abc123');
    delete process.env.GITHUB_TOKEN;
  });

  describe('getGitHub', () => {
    it('should create a new GitHubAPI', () => {
      const gh = new GitHub();
      expect(gitHubSpy.callCount).to.equal(0);
      gh.getGitHub();
      expect(gitHubSpy.callCount).to.equal(1);
    });

    it('should be able to set the Enterprise URL settings', () => {
      const gh = new GitHub('1234', true, {
        baseUrl: 'https://github.example.com:8443/enterprise',
      });
      const api = gh.getGitHub();

      expect((api as any).options).to.deep.equal({
        baseUrl: 'https://github.example.com:8443/enterprise',
        headers: {
          userAgent: 'Electron Forge',
        },
      });
    });

    it('should not override the user agent', () => {
      const gh = new GitHub('1234', true, { headers: { userAgent: 'Something' } });
      const api = gh.getGitHub();

      expect((api as any).options.headers.userAgent).to.equal('Electron Forge');
    });


    it('should throw an exception if a token is required', () => {
      expect(() => {
        const gh = new GitHub(undefined, true);
        gh.getGitHub();
      }).to.throw('Please set GITHUB_TOKEN in your environment to access these features');
    });
  });
});
