import { ElectronProcess } from '@electron-forge/shared-types';
import { expect } from 'chai';
import proxyquire from 'proxyquire';
import sinon, { SinonStub } from 'sinon';

import { StartOptions } from '../../src/api';

describe('start', () => {
  let start: (opts: StartOptions) => Promise<ElectronProcess>;
  let packageJSON: any;
  let resolveStub: SinonStub;
  let spawnStub: SinonStub;
  let shouldOverride: any;
  let processOn: SinonStub<['timeout', () => void]>;

  beforeEach(() => {
    resolveStub = sinon.stub();
    spawnStub = sinon.stub();
    shouldOverride = false;
    packageJSON = require('../fixture/dummy_app/package.json');

    start = proxyquire.noCallThru().load('../../src/api/start', {
      '../util/electron-executable': () => Promise.resolve('fake_electron_path'),
      '../util/electron-version': {
        getElectronVersion: () => Promise.resolve('1.0.0'),
      },
      '../util/forge-config': async () => ({
        pluginInterface: {
          overrideStartLogic: async () => shouldOverride,
          triggerHook: async () => false,
        },
      }),
      '../util/resolve-dir': async (dir: string) => resolveStub(dir),
      '../util/read-package-json': {
        readMutatedPackageJson: () => Promise.resolve(packageJSON),
      },
      '../util/rebuild': () => Promise.resolve(),
      child_process: {
        spawn: spawnStub,
      },
    }).default;
    processOn = sinon.stub(process.stdin, 'on');
  });

  afterEach(() => {
    processOn.restore();
  });

  it('should spawn electron in the correct dir', async () => {
    resolveStub.returnsArg(0);
    await start({
      dir: __dirname,
      interactive: false,
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[0]).to.equal('fake_electron_path');
    expect(spawnStub.firstCall.args[2]).to.have.property('cwd', __dirname);
    expect(spawnStub.firstCall.args[2].env).to.not.have.property('ELECTRON_ENABLE_LOGGING');
  });

  it('should not spawn if a plugin overrides the start command', async () => {
    resolveStub.returnsArg(0);
    shouldOverride = { on: () => {} };
    await start({
      dir: __dirname,
      interactive: false,
    });
    expect(spawnStub.callCount).to.equal(0);
  });

  it('should pass electron \'.\' as the app path if not specified', async () => {
    resolveStub.returnsArg(0);
    await start({
      dir: __dirname,
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[0]).to.equal('fake_electron_path');
    expect(spawnStub.firstCall.args[1][0]).to.equal('.');
  });

  it('should pass electron the app path if specified', async () => {
    resolveStub.returnsArg(0);
    await start({
      dir: __dirname,
      appPath: '/path/to/app.js',
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[0]).to.equal('fake_electron_path');
    expect(spawnStub.firstCall.args[1][0]).to.equal('/path/to/app.js');
  });

  it('should enable electron logging if enableLogging=true', async () => {
    resolveStub.returnsArg(0);
    await start({
      dir: __dirname,
      interactive: false,
      enableLogging: true,
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[0]).to.equal('fake_electron_path');
    expect(spawnStub.firstCall.args[2].env).to.have.property('ELECTRON_ENABLE_LOGGING', 'true');
  });

  it('should enable RUN_AS_NODE if runAsNode=true', async () => {
    resolveStub.returnsArg(0);
    await start({
      dir: __dirname,
      interactive: false,
      runAsNode: true,
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[2].env).to.have.property('ELECTRON_RUN_AS_NODE', 'true');
  });

  it('should disable RUN_AS_NODE if runAsNode=false', async () => {
    resolveStub.returnsArg(0);
    await start({
      dir: __dirname,
      interactive: false,
      runAsNode: false,
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[2].env).to.not.have.property('ELECTRON_RUN_AS_NODE');
  });

  it('should throw if no dir could be found', async () => {
    resolveStub.returns(null);

    await expect(start({})).to.eventually.be.rejectedWith(
      'Failed to locate startable Electron application',
    );
  });

  it('should throw if no version is in package.json', async () => {
    resolveStub.returnsArg(0);
    packageJSON = { ...packageJSON };
    delete packageJSON.version;
    await expect(start({
      dir: __dirname,
      interactive: false,
    })).to.eventually.be.rejectedWith(
      `Please set your application's 'version' in '${__dirname}/package.json'.`,
    );
  });

  it('should pass all args through to the spawned Electron instance', async () => {
    const args = ['magic_arg', 123, 'thingy'];
    resolveStub.returnsArg(0);
    spawnStub.returns(0);
    await start({
      args,
      dir: __dirname,
      interactive: false,
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[0]).to.equal('fake_electron_path');
    expect(spawnStub.firstCall.args[1].slice(1)).to.deep.equal(args);
  });

  it('should pass --inspect at the start of the args if inspect is set', async () => {
    const args = ['magic'];
    resolveStub.returnsArg(0);
    spawnStub.returns(0);
    await start({
      args,
      dir: __dirname,
      interactive: false,
      inspect: true,
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[0]).to.equal('fake_electron_path');
    expect(spawnStub.firstCall.args[1].slice(1)).to.deep.equal(['--inspect'].concat(args));
  });

  it('should pass --inspect-brk at the start of the args if inspectBrk is set', async () => {
    const args = ['magic'];
    resolveStub.returnsArg(0);
    spawnStub.returns(0);
    await start({
      args,
      dir: __dirname,
      interactive: false,
      inspectBrk: true,
    });
    expect(spawnStub.callCount).to.equal(1);
    expect(spawnStub.firstCall.args[0]).to.equal('fake_electron_path');
    expect(spawnStub.firstCall.args[1].slice(1)).to.deep.equal(['--inspect-brk'].concat(args));
  });

  it('should resolve with a handle to the spawned instance', async () => {
    resolveStub.returnsArg(0);
    const fakeChild = { on: () => {} };
    spawnStub.returns(fakeChild);

    await expect(start({
      dir: __dirname,
      interactive: false,
      enableLogging: true,
    })).to.eventually.equal(fakeChild);
  });
});
