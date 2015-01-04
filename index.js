'use strict';

/**
 * Export pooled pg.
 * (C) 2015 Alex Fernández.
 */


// requires
var server = require('./lib/server.js');
var remote = require('./lib/remote.js');
var pooled = require('./lib/pooled.js');

// exports
exports.start = server.start;
exports.pooledConnect = pooled.pooledConnect;
exports.remoteConnect = remote.remoteConnect;
exports.PooledClient = pooled.PooledClient;
exports.RemoteClient = remote.RemoteClient;

