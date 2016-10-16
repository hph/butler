import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readdir, readFile, readFileSync, lstat } from 'fs';
import { basename, join, resolve } from 'path';

import { compile } from 'ejs';
import { contentType } from 'mime-types';
import { map, promisify } from 'bluebird';

const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);
const lstatAsync = promisify(lstat);

const template = compile(readFileSync(join(__dirname, 'template.ejs'), 'utf-8'));

interface DirContents {
  directories: Array<string>;
  files: Array<string>;
}

async function listContents (path: string): Promise<DirContents> {
  const directories = [];
  const files = [];

  const fullPath = resolve(path);
  const contents = await readdirAsync(fullPath);

  await map(contents, async (file: string) => {
    const stats = await lstatAsync(join(fullPath, file));
    if (stats.isFile()) {
      files.push(join(path, file));
    } else {
      directories.push(join(path, file));
    }
  });

  return { directories, files };
}

function hasTemplate (files: Array<string>): boolean {
  return files.some((file: string): boolean => !!file.match(/index.html$/));
}

function notFoundHandler (res: ServerResponse) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 - File not found');
}

function internalErrorHandler (res: ServerResponse) {
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('500 - Internal Server Error');
}

async function fileHandler (res: ServerResponse, path: string) {
  res.writeHead(200, { 'Content-Type': contentType(basename(path)) || 'text/plain' });
  res.end(await readFileAsync(path));
}

async function directoryHandler (res: ServerResponse, path: string) {
  const { directories, files } = await listContents(path);
  if (hasTemplate(files)) {
    res.end(await readFileAsync(resolve(path, 'index.html')));
  } else {
    res.end(template({ directories, files, path }));
  }
}

async function requestHandler (req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = join('.', decodeURI(req.url));
  try {
    const stats = await lstatAsync(path);
    if (stats.isFile()) {
      fileHandler(res, path);
    } else if (stats.isDirectory()) {
      directoryHandler(res, path);
    } else {
      internalErrorHandler(res);
    }
  } catch (err) {
    notFoundHandler(res);
  }
}

export default createServer(requestHandler);
