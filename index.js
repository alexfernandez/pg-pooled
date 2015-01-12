'use strict';

/**
 * Export pooled pg.
 * (C) 2015 Alex Fernández.
 */


// requires
var server = require('./lib/server.js');
var remote = require('./lib/remote.js');
var pooled = require('./lib/pooled.js');
var connect = require('./lib/connect.js');
var defaults = require('./lib/defaults.js');

// exports
exports.start = server.start;
exports.pooledConnect = pooled.pooledConnect;
exports.remoteConnect = remote.remoteConnect;
exports.PooledClient = pooled.PooledClient;
exports.RemoteClient = remote.RemoteClient;
exports.connect = connect.connect;
exports.Client = connect.Client;
exports.end = connect.end;
exports.defaults = defaults;

