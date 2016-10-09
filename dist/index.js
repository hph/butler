"use strict";
var http_1 = require("http");
var fs_1 = require("fs");
var path_1 = require("path");
var ejs_1 = require("ejs");
function listContents(path) {
    var directories = [];
    var files = [];
    var context = path_1.resolve(path);
    fs_1.readdirSync(context).forEach(function (file) {
        var withContext = path_1.join(context, file);
        if (fs_1.lstatSync(withContext).isFile()) {
            files.push(path_1.join(path, file));
        }
        else {
            directories.push(path_1.join(path, file));
        }
    });
    return { directories: directories, files: files };
}
var template = ejs_1.compile(fs_1.readFileSync(path_1.join(__dirname, 'index.ejs'), 'utf-8'));
function notFoundHandler(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 - File not found');
}
function internalErrorHandler(res) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 - Internal Server Error');
}
function fileHandler(path, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(fs_1.readFileSync(path, 'utf-8'));
}
function directoryHandler(path, res) {
    var _a = listContents(path), files = _a.files, directories = _a.directories;
    res.end(template({ directories: directories, files: files, path: path }));
}
var server = http_1.createServer(function (req, res) {
    var path = "." + req.url;
    fs_1.lstat(path, function (err, stats) {
        if (err) {
            return notFoundHandler(res);
        }
        if (stats.isFile()) {
            fileHandler(path, res);
        }
        else if (stats.isDirectory()) {
            directoryHandler(path, res);
        }
        else {
            internalErrorHandler(res);
        }
    });
});
exports.__esModule = true;
exports["default"] = server;
