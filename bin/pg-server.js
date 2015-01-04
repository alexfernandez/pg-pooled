#!/usr/bin/env node
'use strict';

/**
 * Binary to run a pg server.
 * (C) 2015 Alex Fernández.
 */

// requires
var stdio = require('stdio');
var server = require('../lib/server.js');
var packageJson = require(__dirname + '/../package.json');

            
// constants
var PORT = 5432;

// init
var options = stdio.getopt({
	version: {key: 'v', description: 'Display version and quit'},
	port: {key: 'p', args: 1, description: 'Port to connect to', default: PORT},
	host: {key: 'h', args: 1, description: 'Host to connect to'},
	quiet: {description: 'Do not log any messages'},
	debug: {description: 'Show debug messages'},
});
if (options.version)
{
	console.log('Loadtest version: %s', packageJson.version);
	process.exit(0);
}
if (options.args.length > 0)
{
	console.error('Too many arguments: %s', options.args);
	options.printHelp();
	process.exit(1);
}
server.start(options);

