import 'mocha';
import { expect } from 'chai';
import { IncomingMessage, ServerResponse } from 'http';
import * as sinon from 'sinon';
import { resolve } from 'path';
import { readFile as _readFile } from 'fs';
import { promisify } from 'bluebird';

import createButlerServer, {
  createHeaders,
  hasIndexTemplate,
  notFoundHandler,
  internalErrorHandler,
  redirectHandler,
  fileHandler,
  getTrimmedFilename,
  listContents,
  directoryHandler,
  getPathStats,
  logRequest,
  requestHandler,
} from './server';

const readFile = promisify(_readFile);


interface HandlerTestOpts {
  name: Function;
  statusCode: number;
  headers: Object;
  response: string;
}

describe('server', () => {
  describe('hasIndexTemplate', () => {
    it('returns false for empty arrays', () => {
      expect(hasIndexTemplate([])).to.be.false;
    });

    it('returns false for arrays without an index template', () => {
      expect(hasIndexTemplate(['foo.ts', 'bar.html'])).to.be.false;
    });

    it('returns true for arrays with an index template', () => {
      expect(hasIndexTemplate(['foo/index.html', 'bar.html'])).to.be.true;
    });
  });

  describe('createHeaders', () => {
    it('returns default headers when no params are provided', () => {
      expect(createHeaders()).to.deep.eq({
        'Content-Type': 'text/plain; charset=utf-8',
      });
    });

    it('returns headers based on the param when provided', () => {
      expect(createHeaders('example.txt')).to.deep.eq({
        'Content-Type': 'text/plain; charset=utf-8',
      });
      expect(createHeaders('example.js')).to.deep.eq({
        'Content-Type': 'application/javascript; charset=utf-8',
      });
      expect(createHeaders('example.ts')).to.deep.eq({
        'Content-Type': 'video/mp2t',
      });
    });

    it('should default to plaintext for unknown mimetypes', () => {
      expect(createHeaders('example.invalid')).to.deep.eq({
        'Content-Type': 'text/plain; charset=utf-8',
      });
    });
  });

  const generateHandlerTests = (opts: HandlerTestOpts, redirectUrl?: string) => {
    describe(opts.name.name, () => {
      it('should serve the appropriate response', () => {
        const res = <ServerResponse>{};
        const writeHead = res.writeHead = sinon.spy();
        const end = res.end = sinon.spy();
        opts.name(res, redirectUrl);
        expect(writeHead.called).to.be.true;
        expect(end.called).to.be.true;
        expect(writeHead.getCall(0).args).to.deep.eq([opts.statusCode, opts.headers]);
        expect(end.getCall(0).args[0]).to.eq(opts.response);
      });
    });
  };

  generateHandlerTests({
    name: notFoundHandler,
    statusCode: 404,
    headers: createHeaders(),
    response: '404 - File Not Found',
  });

  generateHandlerTests({
    name: internalErrorHandler,
    statusCode: 500,
    headers: createHeaders(),
    response: '500 - Internal Server Error',
  });

  generateHandlerTests({
    name: redirectHandler,
    statusCode: 302,
    headers: { Location: '/foo' },
    response: undefined,
  }, '/foo');

  describe('fileHandler', () => {
    it('should serve the appropriate response', async () => {
      const res = <ServerResponse>{};
      const writeHead = res.writeHead = sinon.spy();
      const end = res.end = sinon.spy();
      const path = './dist/server.test.js';
      const contents = await readFile(path);
      await fileHandler(res, path);
      expect(writeHead.called).to.be.true;
      expect(writeHead.getCall(0).args).to.deep.eq([200, createHeaders(path)]);
      expect(end.called).to.be.true;
      expect(end.getCall(0).args[0]).to.deep.eq(contents);
    });
  });

  describe('getTrimmedFilename', () => {
    it('should return the path to the filerelative to the directory', () => {
      // The file is in the immediate directory.
      expect(getTrimmedFilename('/foo/bar', 'file.ts', '/foo/bar')).to.eq('file.ts');
      // The file is in a subdirectory.
      expect(getTrimmedFilename('/foo/bar/baz', 'file.ts', '/foo/bar')).to.eq('baz/file.ts');
      // The file is in a subdirectory of a subdirectory.
      expect(getTrimmedFilename('/foo/bar/baz', 'file.ts', '/foo')).to.eq('bar/baz/file.ts');
    });

    it('should keep the leading slash when the root directory is /', () => {
      // This gets called for the initial list of files and directories for /.
      expect(getTrimmedFilename('/foo/bar', '', '/')).to.eq('foo/bar');
      expect(getTrimmedFilename('/foo', 'file.ts', '/')).to.eq('foo/file.ts');
    });
  });

  describe('listContents', () => {
    const server = createButlerServer({
      port: '8080',
      directory: './',
      basePath: '/',
    }, () => {});

    it('should return all immediate files and directories', async () => {
      const { directories, files } = await listContents('./test/sample');
      expect(directories).to.deep.eq(['test/sample/bar']);
      expect(files).to.deep.eq(['test/sample/foo.txt']);
    });
  });

  describe('directoryHandler', () => {
    it('should render a list of files and directories if there is no index.html', async () => {
      const res = <ServerResponse>{};
      const end = res.end = sinon.spy();
      await directoryHandler(res, './test/sample');
      expect(end.called).to.be.true;
      const output = end.getCall(0).args[0];
      expect(!!output.match('<h1>Files in ./test/sample</h1>')).to.be.true;
    });

    it('should render an index.html file when found', async () => {
      const res = <ServerResponse>{};
      const end = res.end = sinon.spy();
      await directoryHandler(res, './test/sample/bar');
      expect(end.called).to.be.true;
      const output = end.getCall(0).args[0].toString();
      expect(!!output.match('<h1>Hello!</h1>')).to.be.true;
    });
  });

  describe('getPathStats', () => {
    it('should return the expected values', async () => {
      const { path, stats } = await getPathStats('/test');
      expect(path).to.eq(resolve('./test'));
      expect(stats.isDirectory()).to.be.true;
    });

    it('should follow symlinks as required', async () => {
      const { path, stats } = await getPathStats('/test/sample/bar/symlink');
      expect(stats.isSymbolicLink()).to.be.false;
      expect(path).to.eq(resolve('./test/sample/foo.txt'));
    });
  });

  // These tests are quite weird and badly factored in nature due to
  // difficulties in spying on the functions that requestHandler delegates to,
  // for unknown reasons.
  describe('requestHandler', () => {
    const createRequest = (url: string, callback: Function) => {
      const req = <IncomingMessage>{
        url,
        headers: {
          host: '127.0.0.1',
          'x-forwarded-for': '127.0.0.1',
        },
      };
      const res = <ServerResponse>{};
      res.writeHead = sinon.spy();
      const end = res.end = sinon.spy();

      requestHandler(req, res).then(() => {
        setTimeout(() => {
          const output = end.getCall(0).args[0];
          callback(output);
        }, 10);
      });

    };

    it('should serve requests for directory urls appropriately', (done) => {
      createRequest('/test/sample', (output: string) => {
        expect(!!output.match(/test\/sample/)).to.be.true;
        done();
      });
    });

    it('should serve requests for files appropriately', (done) => {
      createRequest('/test/sample/foo.txt', (output: string) => {
        expect(!!output.toString().match(/Hi there\!/)).to.be.true;
        done();
      });
    });
  });
});
