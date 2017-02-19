#!/usr/bin/env node

import { argv } from 'yargs';
import { connect } from 'ngrok';

import server from './server';


const help = `butler - A static file server written in TypeScript.

Options:

  --port <PORT> Specify the port from which to serve (default: 8080).
  --ngrok       Create a secure tunnel to the local server using ngrok.
`;


export function main () {
  if (argv.h || argv.help) {
    console.log(help);
    process.exit();
  }

  const port = argv.port || 8080;

  server.listen(port, () => {
    console.log(`Serving at http://localhost:${port}`);
  });

  if (argv.ngrok) {
    connect(port, (err, address) => {
      console.log(`Proxying at ${address}`);
    });
  }
}
