"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
const sinon = require("sinon");
const path_1 = require("path");
const fs_1 = require("fs");
const bluebird_1 = require("bluebird");
const server_1 = require("./server");
const readFile = bluebird_1.promisify(fs_1.readFile);
describe('server', () => {
    describe('hasIndexTemplate', () => {
        it('returns false for empty arrays', () => {
            chai_1.expect(server_1.hasIndexTemplate([])).to.be.false;
        });
        it('returns false for arrays without an index template', () => {
            chai_1.expect(server_1.hasIndexTemplate(['foo.ts', 'bar.html'])).to.be.false;
        });
        it('returns true for arrays with an index template', () => {
            chai_1.expect(server_1.hasIndexTemplate(['foo/index.html', 'bar.html'])).to.be.true;
        });
    });
    describe('createHeaders', () => {
        it('returns default headers when no params are provided', () => {
            chai_1.expect(server_1.createHeaders()).to.deep.eq({
                'Content-Type': 'text/plain; charset=utf-8',
            });
        });
        it('returns headers based on the param when provided', () => {
            chai_1.expect(server_1.createHeaders('example.txt')).to.deep.eq({
                'Content-Type': 'text/plain; charset=utf-8',
            });
            chai_1.expect(server_1.createHeaders('example.js')).to.deep.eq({
                'Content-Type': 'application/javascript; charset=utf-8',
            });
            chai_1.expect(server_1.createHeaders('example.ts')).to.deep.eq({
                'Content-Type': 'video/mp2t',
            });
        });
        it('should default to plaintext for unknown mimetypes', () => {
            chai_1.expect(server_1.createHeaders('example.invalid')).to.deep.eq({
                'Content-Type': 'text/plain; charset=utf-8',
            });
        });
    });
    const generateHandlerTests = (opts, redirectUrl) => {
        describe(opts.name.name, () => {
            it('should serve the appropriate response', () => {
                const res = {};
                const writeHead = res.writeHead = sinon.spy();
                const end = res.end = sinon.spy();
                opts.name(res, redirectUrl);
                chai_1.expect(writeHead.called).to.be.true;
                chai_1.expect(end.called).to.be.true;
                chai_1.expect(writeHead.getCall(0).args).to.deep.eq([opts.statusCode, opts.headers]);
                chai_1.expect(end.getCall(0).args[0]).to.eq(opts.response);
            });
        });
    };
    generateHandlerTests({
        name: server_1.notFoundHandler,
        statusCode: 404,
        headers: server_1.createHeaders(),
        response: '404 - File Not Found',
    });
    generateHandlerTests({
        name: server_1.internalErrorHandler,
        statusCode: 500,
        headers: server_1.createHeaders(),
        response: '500 - Internal Server Error',
    });
    generateHandlerTests({
        name: server_1.redirectHandler,
        statusCode: 302,
        headers: { Location: '/foo' },
        response: undefined,
    }, '/foo');
    describe('fileHandler', () => {
        it('should serve the appropriate response', () => __awaiter(this, void 0, void 0, function* () {
            const res = {};
            const writeHead = res.writeHead = sinon.spy();
            const end = res.end = sinon.spy();
            const path = './dist/server.test.js';
            const contents = yield readFile(path);
            yield server_1.fileHandler(res, path);
            chai_1.expect(writeHead.called).to.be.true;
            chai_1.expect(writeHead.getCall(0).args).to.deep.eq([200, server_1.createHeaders(path)]);
            chai_1.expect(end.called).to.be.true;
            chai_1.expect(end.getCall(0).args[0]).to.deep.eq(contents);
        }));
    });
    describe('getTrimmedFilename', () => {
        it('should return the path to the filerelative to the directory', () => {
            // The file is in the immediate directory.
            chai_1.expect(server_1.getTrimmedFilename('/foo/bar', 'file.ts', '/foo/bar')).to.eq('file.ts');
            // The file is in a subdirectory.
            chai_1.expect(server_1.getTrimmedFilename('/foo/bar/baz', 'file.ts', '/foo/bar')).to.eq('baz/file.ts');
            // The file is in a subdirectory of a subdirectory.
            chai_1.expect(server_1.getTrimmedFilename('/foo/bar/baz', 'file.ts', '/foo')).to.eq('bar/baz/file.ts');
        });
        it('should keep the leading slash when the root directory is /', () => {
            // This gets called for the initial list of files and directories for /.
            chai_1.expect(server_1.getTrimmedFilename('/foo/bar', '', '/')).to.eq('foo/bar');
            chai_1.expect(server_1.getTrimmedFilename('/foo', 'file.ts', '/')).to.eq('foo/file.ts');
        });
    });
    describe('listContents', () => {
        const server = server_1.default({
            port: '8080',
            directory: './',
            basePath: '/',
            forceTls: false,
        }, () => { });
        it('should return all immediate files and directories', () => __awaiter(this, void 0, void 0, function* () {
            const { directories, files } = yield server_1.listContents('./test/sample');
            chai_1.expect(directories).to.deep.eq(['test/sample/bar']);
            chai_1.expect(files).to.deep.eq(['test/sample/foo.txt']);
        }));
    });
    describe('directoryHandler', () => {
        it('should render a list of files and directories if there is no index.html', () => __awaiter(this, void 0, void 0, function* () {
            const res = {};
            const end = res.end = sinon.spy();
            yield server_1.directoryHandler(res, './test/sample');
            chai_1.expect(end.called).to.be.true;
            const output = end.getCall(0).args[0];
            chai_1.expect(!!output.match('<h1>Files in ./test/sample</h1>')).to.be.true;
        }));
        it('should render an index.html file when found', () => __awaiter(this, void 0, void 0, function* () {
            const res = {};
            const end = res.end = sinon.spy();
            yield server_1.directoryHandler(res, './test/sample/bar');
            chai_1.expect(end.called).to.be.true;
            const output = end.getCall(0).args[0].toString();
            chai_1.expect(!!output.match('<h1>Hello!</h1>')).to.be.true;
        }));
    });
    describe('getPathStats', () => {
        it('should return the expected values', () => __awaiter(this, void 0, void 0, function* () {
            const { path, stats } = yield server_1.getPathStats('/test');
            chai_1.expect(path).to.eq(path_1.resolve('./test'));
            chai_1.expect(stats.isDirectory()).to.be.true;
        }));
        it('should follow symlinks as required', () => __awaiter(this, void 0, void 0, function* () {
            const { path, stats } = yield server_1.getPathStats('/test/sample/bar/symlink');
            chai_1.expect(stats.isSymbolicLink()).to.be.false;
            chai_1.expect(path).to.eq(path_1.resolve('./test/sample/foo.txt'));
        }));
    });
    // These tests are quite weird and badly factored in nature due to
    // difficulties in spying on the functions that requestHandler delegates to,
    // for unknown reasons.
    describe('requestHandler', () => {
        const createRequest = (url, callback) => {
            const req = {
                url,
                headers: {
                    host: '127.0.0.1',
                    'x-forwarded-for': '127.0.0.1',
                },
            };
            const res = {};
            res.writeHead = sinon.spy();
            const end = res.end = sinon.spy();
            server_1.requestHandler(req, res).then(() => {
                setTimeout(() => {
                    const output = end.getCall(0).args[0];
                    callback(output);
                }, 10);
            });
        };
        it('should serve requests for directory urls appropriately', (done) => {
            createRequest('/test/sample', (output) => {
                chai_1.expect(!!output.match(/test\/sample/)).to.be.true;
                done();
            });
        });
        it('should serve requests for files appropriately', (done) => {
            createRequest('/test/sample/foo.txt', (output) => {
                chai_1.expect(!!output.toString().match(/Hi there\!/)).to.be.true;
                done();
            });
        });
    });
});
