# Butler

[![Package Version](https://img.shields.io/npm/v/butler-server.svg)](https://www.npmjs.com/package/butler-server)
[![License](https://img.shields.io/npm/l/butler-server.svg)](https://tldrlegal.com/license/mit-license)

> A static file server written in TypeScript.

## Usage

From within any directory, simply run Butler in the terminal:

    butler

A server will be launched on port `localhost:8080`, listing all directories and
files in the current directory. Directories containing an `index.html` file
will automatically render them instead of listing files. You can also provide a
directory name as an argument when running `butler` in order to serve files
from that directory (as opposed to the current working directory).

## Advanced options

You may provide one or more options when running `butler`.

- `--port` Specify the port from which to serve (default: 8080).
- `--ngrok` Create a secure tunnel to the local server using ngrok. Please
  note that the address is publicly accessible and may expose private files.
- `--base-path` Specify the base URL from which to serve (default: `/`).
  pecifying a leading and trailing slash is optional but they will be added
  automatically. In addition, a redirect is set up in order to direct all
  requests that lack the base path to the correct URL.

## Install

You must install Butler globally:

    yarn global add butler-server  # Or npm install -g butler-server

Note that the correct NPM package name is `butler-server`, **not** `butler`.
