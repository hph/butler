#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = require("yargs");
const ngrok_1 = require("ngrok");
const chalk = require("chalk");
const server_1 = require("./server");
const help = `butler - A static file server written in TypeScript.

Usage:

  butler [directory] [options]

  If no directory is specified, butler defaults to the current working directory.

Options:

  --port       Specify the port from which to serve (default: 8080).
  --ngrok      Create a secure tunnel to the local server using ngrok.
               Please note that the address is publicly accessible and
               may expose private files.
  --base-path  Specify the base URL from which to serve (default: /).
               pecifying a leading and trailing slash is optional but
               they will be added automatically. In addition, a redirect
               is set up so that requests to / go to the base path URL.
`;
function normalizeBasePath(path) {
    if (!path.startsWith('/')) {
        path = `/${path}`;
    }
    if (!path.endsWith('/')) {
        path += '/';
    }
    return path;
}
function main() {
    if (yargs_1.argv.h || yargs_1.argv.help) {
        console.log(help);
        process.exit();
    }
    const port = yargs_1.argv.port || '8080';
    const directory = yargs_1.argv._.length ? yargs_1.argv._[0] : './';
    const basePath = normalizeBasePath(yargs_1.argv.basePath || '');
    const options = { port, directory, basePath };
    server_1.default(options, () => {
        console.log(chalk.white('Butler serving'), chalk.red('@'), chalk.white(`http://localhost:${port}${basePath}`));
    });
    if (yargs_1.argv.ngrok) {
        ngrok_1.connect(port, (err, address) => {
            console.log(chalk.white('Proxying'), chalk.red('@'), chalk.white(`${address}${basePath}`));
        });
    }
}
exports.main = main;
