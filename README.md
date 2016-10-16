# butler

> A static file server written in TypeScript.

## Usage

From within any directory, simply run `butler`:

    butler

A server will be launched on port `localhost:8080`, listing all directories and
files in the current directory. Directories containing an `index.html` file
will automatically render them instead of listing files.

## Advanced options

You may provide one or more options when running `butler`.

- `--port`: Specify the port from which to serve (defaults to `8080`).
- `--ngrok`: Create a secure tunnel to the local server using [ngrok](https://ngrok.com/).
  Please note that the address is publicly accessible and may expose private files.

## Install

You must install `butler` globally:

    npm install -g butler-server

