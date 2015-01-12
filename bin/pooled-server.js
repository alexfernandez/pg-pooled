#!/usr/bin/env node
'use strict';

/**
 * Binary to run a pg server.
 * (C) 2015 Alex Fernández.
 */

// requires
var Log = require('log');
var stdio = require('stdio');
var server = require('../lib/server.js');
var packageJson = require(__dirname + '/../package.json');

// globals
var log = new Log('info');

// constants
var PORT = 5433;

// init
var options = stdio.getopt({
	version: {key: 'v', description: 'Display version and quit'},
	port: {key: 'p', args: 1, description: 'Port to connect to', default: PORT},
	host: {key: 'h', args: 1, description: 'Host to connect to'},
	cluster: {key: 'c', args: 1, description: 'Enable cluster (multiprocess) mode'},
	silent: {key: 's', description: 'Do not log any messages'},
	debug: {key: 'd', description: 'Show debug messages'},
});
if (options.version)
{
	console.log('Loadtest version: %s', packageJson.version);
	process.exit(0);
}
if (options.args && options.args.length > 0)
{
	console.error('Too many arguments: %s', options.args);
	options.printHelp();
	process.exit(1);
}
server.start(options, function(error, result)
{
	if (error)
	{
		return console.error('Could not start server on port %s: %s', options.port, error);
	}
	log.info('PostgreSQL server started on port %s: %s', options.port, result);
});

