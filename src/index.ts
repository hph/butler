#!/usr/bin/env node

import { argv } from 'yargs';

import * as chalk from 'chalk';

import createButlerServer, { ButlerOptions } from './server';


const help = `butler - A static file server written in TypeScript.

Usage:

  butler [directory] [options]

  If no directory is specified, butler defaults to the current working directory.

Options:

  --port       Specify the port from which to serve (default: 8080).
  --base-path  Specify the base URL from which to serve (default: /).
               pecifying a leading and trailing slash is optional but
               they will be added automatically. In addition, a redirect
               is set up so that requests to / go to the base path URL.
`;

function normalizeBasePath (path: string): string {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (!path.endsWith('/')) {
    path += '/';
  }
  return path;
}

export function main (): void {
  if (argv.h || argv.help) {
    console.log(help);
    process.exit();
  }

  const port = argv.port || '8080';
  const directory = argv._.length ? argv._[0] : './';
  const basePath = normalizeBasePath(argv.basePath || '');
  const forceTls = argv.forceTls ? true : false;
  const options: ButlerOptions = { port, directory, basePath, forceTls };

  createButlerServer(options, () => {
    console.log(
      chalk.white('Butler serving'),
      chalk.red('@'),
      chalk.white(`http://localhost:${port}${basePath}`),
    );
  });
}
