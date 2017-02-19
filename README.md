# Butler

[![Package Version](https://img.shields.io/npm/v/butler-server.svg)](https://www.npmjs.com/package/butler-server)
[![License](https://img.shields.io/npm/l/butler-server.svg)](https://tldrlegal.com/license/mit-license)

> A static file server written in TypeScript.

## Usage

From within any directory, simply run `butler` in the terminal:

    butler

A server will be launched on port `localhost:8080`, listing all directories and
files in the current directory. Directories containing an `index.html` file
will automatically render them instead of listing files. You can also provide a
directory name as an argument when running `butler` in order to serve files
from that directory (as opposed to the current working directory).

## Advanced options

You may provide one or more options when running `butler`.

- `--port`: Specify the port from which to serve (defaults to `8080`).
- `--ngrok`: Create a secure tunnel to the local server using [ngrok](https://ngrok.com/).
  Please note that the address is publicly accessible and may expose private files.

## Install

You must install `butler` globally:

    yarn global add butler-server  # Or npm install -g butler-server

