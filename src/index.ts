import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readdirSync, readFileSync, lstat, lstatSync } from 'fs';
import { join, resolve } from 'path';

import { compile } from 'ejs'


interface DirContents {
  directories: Array<string>,
  files: Array<string>,
}

function listContents (path: string): DirContents {
  const directories = [];
  const files = [];

  const context = resolve(path);
  readdirSync(context).forEach(file => {
    const withContext = join(context, file);
    if (lstatSync(withContext).isFile()) {
      files.push(join(path, file));
    } else {
      directories.push(join(path, file));
    }
  });

  return { directories, files };
}

const template = compile(readFileSync(join(__dirname, 'index.ejs'), 'utf-8'));

function notFoundHandler (res: ServerResponse) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 - File not found');
}

function internalErrorHandler (res: ServerResponse) {
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('500 - Internal Server Error');
}

function fileHandler (path: string, res: ServerResponse) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(readFileSync(path, 'utf-8'));
}

function directoryHandler (path: string, res: ServerResponse) {
  const { files, directories } = listContents(path);
  res.end(template({ directories, files, path }));
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const path = `.${req.url}`;
  lstat(path, (err, stats) => {
    if (err) {
      return notFoundHandler(res);
    }
    if (stats.isFile()) {
      fileHandler(path, res);
    } else if (stats.isDirectory()) {
      directoryHandler(path, res);
    } else {
      internalErrorHandler(res);
    }
  });
});

export default server;