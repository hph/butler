import { createServer, IncomingMessage, ServerResponse } from 'http';
import {
  readFileSync,
  lstat as _lstat,
  readFile as _readFile,
  readdir as _readdir,
  realpath as _realpath,
} from 'fs';
import { basename, join, resolve } from 'path';

import * as chalk from 'chalk';
import { format } from 'date-fns';
import { compile } from 'ejs';
import { contentType as getContentType } from 'mime-types';
import { map, promisify } from 'bluebird';

// Promisify callback-style methods as promises for async/await.
const readdir = promisify(_readdir);
const readFile = promisify(_readFile);
const realpath = promisify(_realpath);
const lstat = promisify(_lstat);

// Configure globals required throughout the module.
let opts: ButlerOptions;
const template = compile(readFileSync(join(__dirname, 'template.ejs'), 'utf-8'));


export interface ButlerOptions {
  port: string;
  directory: string;
}

interface DirContents {
  directories: Array<string>;
  files: Array<string>;
}

interface ResponseHeaders {
  'Content-Type': string;
}

interface FileStats {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

interface ReadError {
  code: string;
}

interface PathStats {
  path: string;
  stats: FileStats;
  error?: ReadError;
}


function hasIndexTemplate (files: Array<string>): boolean {
  return files.some((file: string): boolean => !!file.match(/index.html$/));
}

function createHeaders (path?: string): ResponseHeaders {
  const defaultValue = 'text/plain; charset=utf-8';
  const contentType = path ? (getContentType(basename(path)) || defaultValue) : defaultValue;
  return { 'Content-Type': contentType };
}

function notFoundHandler (res: ServerResponse) {
  res.writeHead(404, createHeaders());
  res.end('404 - File not found');
}

function internalErrorHandler (res: ServerResponse) {
  res.writeHead(500, createHeaders());
  res.end('500 - Internal Server Error');
}

/**
 * Read the file at the provided path and write to the response along
 * with the appropriate headers.
 */
async function fileHandler (res: ServerResponse, path: string) {
  res.writeHead(200, createHeaders(path));
  res.end(await readFile(path));
}

/**
 * Trim the filename so that it only includes subdirectories of the root
 * directory as part of the pathname, not the absolute path.
 * Example: Given a root directory of "/Users/butler/" and the contents being a
 * single directory "example/" with a file "example.txt", the function should
 * return "example/example.txt" instead of "/Users/butler/example/example.txt".
 */
function getTrimmedFilename (path: string, file: string, rootDirectory: string): string {
  const name = join(path, file);
  let trimLength = resolve(opts.directory).length;

  // Handle system root directory ("/") edge case.
  if (trimLength !== 1) {
    trimLength += 1;
  }

  return name.substr(trimLength);
}

/**
 * Return a list of files and subdirectories at the given path.
 */
async function listContents (path: string): Promise<DirContents> {
  const directories: Array<string> = [];
  const files: Array<string> = [];

  const fullPath = resolve(path);
  const contents = await readdir(fullPath);

  await map(contents, async (file: string) => {
    const stats = await lstat(join(fullPath, file));
    const name = getTrimmedFilename(path, file, opts.directory);
    if (stats.isDirectory()) {
      directories.push(name);
    } else {
      files.push(name);
    }
  });

  return { directories, files };
}

/**
 * Read the files in the directory at the provided path and write to the
 * response as appropriate; if there is an index.html file it is served,
 * otherwise a template listing the files is rendered.
 */
async function directoryHandler (res: ServerResponse, path: string) {
  const { directories, files } = await listContents(path);
  if (hasIndexTemplate(files)) {
    res.end(await readFile(resolve(path, 'index.html')));
  } else {
    res.end(template({ directories, files, path }));
  }
}

/**
 * Parse the provided URL into a path and read the file there.
 * Return the path, the path stats and any errors encountered.
 */
async function getPathStats (url: string): Promise<PathStats> {
  let path = join(resolve(opts.directory), decodeURI(url));
  let stats;
  let error;

  try {
    stats = await lstat(path);

    // Follow symbolic link when required.
    if (stats.isSymbolicLink()) {
      path = await realpath(path) as string;
      stats = await lstat(path);
    }
  } catch (err) {
    error = err;
  }

  return { path, stats, error };
}

/**
 * Parse and log the request.
 */
function logRequest (req: IncomingMessage): void {
  const time = format(new Date(), 'DD/MM/YY HH:MM:SS');
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (ip.startsWith('::ffff:')) {
    ip = ip.substr(7);
  }
  console.log(
    chalk.white(ip),
    chalk.red('@'),
    chalk.white(time),
    chalk.red('>'),
    `${chalk.white(req.headers.host)}${chalk.blue(req.url)}`,
  );
}

/**
 * Handle server requests by delegating to other functions that examine
 * the URL and then serve a response for files, folders, symbolic links or
 * errors as appropriate.
 */
async function requestHandler (req: IncomingMessage, res: ServerResponse): Promise<void> {
  logRequest(req);

  const { path, stats, error } = await getPathStats(req.url);
  if (error) {
    return error.code === 'ENOENT' && notFoundHandler(res) || internalErrorHandler(res);
  }

  if (stats.isFile()) {
    fileHandler(res, path);
  } else if (stats.isDirectory()) {
    directoryHandler(res, path);
  } else {
    internalErrorHandler(res);
  }
}


export default function createButlerServer (options: ButlerOptions, callback: Function): void {
  if (options) {
    opts = options;
  }
  createServer(requestHandler).listen(options.port);
  callback();
}
