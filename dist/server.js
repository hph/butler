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
const http_1 = require("http");
const fs_1 = require("fs");
const path_1 = require("path");
const chalk = require("chalk");
const date_fns_1 = require("date-fns");
const ejs_1 = require("ejs");
const mime_types_1 = require("mime-types");
const bluebird_1 = require("bluebird");
// Promisify callback-style methods as promises for async/await.
const readdir = bluebird_1.promisify(fs_1.readdir);
const readFile = bluebird_1.promisify(fs_1.readFile);
const realpath = bluebird_1.promisify(fs_1.realpath);
const lstat = bluebird_1.promisify(fs_1.lstat);
// Configure globals required throughout the module.
let opts;
const template = ejs_1.compile(fs_1.readFileSync(path_1.join(__dirname, 'template.ejs'), 'utf-8'));
function hasIndexTemplate(files) {
    return files.some((file) => !!file.match(/index.html$/));
}
exports.hasIndexTemplate = hasIndexTemplate;
function createHeaders(path) {
    const defaultValue = 'text/plain; charset=utf-8';
    const contentType = path ? (mime_types_1.contentType(path_1.basename(path)) || defaultValue) : defaultValue;
    return { 'Content-Type': contentType };
}
exports.createHeaders = createHeaders;
function notFoundHandler(res) {
    res.writeHead(404, createHeaders());
    res.end('404 - File Not Found');
}
exports.notFoundHandler = notFoundHandler;
function internalErrorHandler(res) {
    res.writeHead(500, createHeaders());
    res.end('500 - Internal Server Error');
}
exports.internalErrorHandler = internalErrorHandler;
function redirectHandler(res, redirectUrl) {
    res.writeHead(302, { Location: redirectUrl });
    res.end();
}
exports.redirectHandler = redirectHandler;
/**
 * Read the file at the provided path and write to the response along
 * with the appropriate headers.
 */
function fileHandler(res, path) {
    return __awaiter(this, void 0, void 0, function* () {
        res.writeHead(200, createHeaders(path));
        res.end(yield readFile(path));
    });
}
exports.fileHandler = fileHandler;
/**
 * Trim the filename so that it only includes subdirectories of the root
 * directory as part of the pathname, not the absolute path.
 * Example: Given a root directory of "/Users/butler/" and the contents being a
 * single directory "example/" with a file "example.txt", the function should
 * return "example/example.txt" instead of "/Users/butler/example/example.txt".
 */
function getTrimmedFilename(path, file, rootDirectory) {
    const name = path_1.join(path_1.resolve(path), file);
    let trimLength = path_1.resolve(rootDirectory).length + 1;
    // Handle edge case for the system root directory ("/").
    if (trimLength === 2) {
        trimLength = 1;
    }
    return name.substr(trimLength);
}
exports.getTrimmedFilename = getTrimmedFilename;
/**
 * Return a list of files and subdirectories at the given path.
 */
function listContents(path) {
    return __awaiter(this, void 0, void 0, function* () {
        const directories = [];
        const files = [];
        const fullPath = path_1.resolve(path);
        const contents = yield readdir(fullPath);
        yield bluebird_1.map(contents, (file) => __awaiter(this, void 0, void 0, function* () {
            const stats = yield lstat(path_1.join(fullPath, file));
            const name = getTrimmedFilename(path, file, opts.directory);
            if (stats.isDirectory()) {
                directories.push(name);
            }
            else {
                files.push(name);
            }
        }));
        return { directories, files };
    });
}
exports.listContents = listContents;
/**
 * Read the files in the directory at the provided path and write to the
 * response as appropriate; if there is an index.html file it is served,
 * otherwise a template listing the files is rendered.
 */
function directoryHandler(res, path) {
    return __awaiter(this, void 0, void 0, function* () {
        const { directories, files } = yield listContents(path);
        if (hasIndexTemplate(files)) {
            res.end(yield readFile(path_1.resolve(path, 'index.html')));
        }
        else {
            res.end(template({ directories, files, path }));
        }
    });
}
exports.directoryHandler = directoryHandler;
/**
 * Parse the provided URL into a path and read the file there.
 * Return the path, the path stats and any errors encountered.
 */
function getPathStats(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let path = path_1.join(path_1.resolve(opts.directory), decodeURI(url));
        let stats;
        let error;
        try {
            stats = yield lstat(path);
            // Follow symbolic link when required.
            if (stats.isSymbolicLink()) {
                path = (yield realpath(path));
                stats = yield lstat(path);
            }
        }
        catch (err) {
            error = err;
        }
        return { path, stats, error };
    });
}
exports.getPathStats = getPathStats;
/**
 * Parse and log the request.
 */
function logRequest(req) {
    const time = date_fns_1.format(new Date(), 'DD/MM/YY HH:mm:ss');
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ip.startsWith('::ffff:')) {
        ip = ip.substr(7);
    }
    console.log(chalk.white(ip), chalk.red('@'), chalk.white(time), chalk.red('>'), `${chalk.white(req.headers.host)}${chalk.blue(req.url)}`);
}
exports.logRequest = logRequest;
/**
 * Handle server requests by delegating to other functions that examine
 * the URL and then serve a response for files, folders, symbolic links or
 * errors as appropriate.
 */
function requestHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        logRequest(req);
        if (!req.url.startsWith(opts.basePath)) {
            return redirectHandler(res, `${opts.basePath}${req.url.substr(1)}`);
        }
        const url = req.url.substr(opts.basePath.length);
        const { path, stats, error } = yield getPathStats(url);
        if (error) {
            return error.code === 'ENOENT' && notFoundHandler(res) || internalErrorHandler(res);
        }
        if (stats.isFile()) {
            fileHandler(res, path);
        }
        else if (stats.isDirectory()) {
            directoryHandler(res, path);
        }
        else {
            internalErrorHandler(res);
        }
    });
}
exports.requestHandler = requestHandler;
function createButlerServer(options, callback) {
    if (options) {
        opts = options;
    }
    http_1.createServer(requestHandler).listen(options.port);
    callback();
}
exports.default = createButlerServer;
