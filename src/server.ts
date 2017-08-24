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
  basePath: string;
  forceTls: boolean;
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


export function hasIndexTemplate (files: Array<string>): boolean {
  return files.some((file: string): boolean => !!file.match(/index.html$/));
}

export function createHeaders (path?: string): ResponseHeaders {
  const defaultValue = 'text/plain; charset=utf-8';
  const contentType = path ? (getContentType(basename(path)) || defaultValue) : defaultValue;
  return { 'Content-Type': contentType };
}

export function notFoundHandler (res: ServerResponse): void {
  res.writeHead(404, createHeaders());
  res.end('404 - File Not Found');
}

export function internalErrorHandler (res: ServerResponse): void {
  res.writeHead(500, createHeaders());
  res.end('500 - Internal Server Error');
}

export function redirectHandler (res: ServerResponse, redirectUrl: string): void {
  res.writeHead(302, { Location: redirectUrl });
  res.end();
}

/**
 * Read the file at the provided path and write to the response along
 * with the appropriate headers.
 */
export async function fileHandler (res: ServerResponse, path: string) {
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
export function getTrimmedFilename (path: string, file: string, rootDirectory: string): string {
  const name = join(resolve(path), file);
  let trimLength = resolve(rootDirectory).length + 1;

  // Handle edge case for the system root directory ("/").
  if (trimLength === 2) {
    trimLength = 1;
  }

  return name.substr(trimLength);
}

/**
 * Return a list of files and subdirectories at the given path.
 */
export async function listContents (path: string): Promise<DirContents> {
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
export async function directoryHandler (res: ServerResponse, path: string) {
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
export async function getPathStats (url: string): Promise<PathStats> {
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
export function logRequest (req: IncomingMessage): void {
  const time = format(new Date(), 'DD/MM/YY HH:mm:ss');
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
export async function requestHandler (req: IncomingMessage, res: ServerResponse): Promise<void> {
  logRequest(req);

  if (!req.url.startsWith(opts.basePath)) {
    return redirectHandler(res, `${opts.basePath}${req.url.substr(1)}`);
  }

  if (opts.forceTls) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=8640000; includeSubDomains',
    );

    if (!req.headers['x-forwarded-proto']) {
      res.writeHead(302, {
        Location: `https://${req.headers.host}${req.url}`,
      });
      res.end();
      return;
    }
  }

  const url = req.url.substr(opts.basePath.length);
  const { path, stats, error } = await getPathStats(url);
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
