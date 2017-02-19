#!/usr/bin/env node

import { argv } from 'yargs';
import { connect } from 'ngrok';

import * as chalk from 'chalk';

import createButlerServer, { ButlerOptions } from './server';


const help = `butler - A static file server written in TypeScript.

Usage:

  butler [directory] [options]

  If no directory is specified, butler defaults to the current working directory.

Options:

  --port <PORT> Specify the port from which to serve (default: 8080).
  --ngrok       Create a secure tunnel to the local server using ngrok.
`;


export function main () {
  if (argv.h || argv.help) {
    console.log(help);
    process.exit();
  }

  const port = argv.port || '8080';
  const directory = argv._.length ? argv._[0] : './';
  const options: ButlerOptions = { port, directory };

  createButlerServer(options, () => {
    console.log(
      chalk.white('Butler serving'),
      chalk.red('@'),
      chalk.white(`http://localhost:${port}`),
    );
  });

  if (argv.ngrok) {
    connect(port, (err, address) => {
      console.log(
        chalk.white('Proxying'),
        chalk.red('@'),
        chalk.white(address),
      );
    });
  }
}
