#!/usr/bin/env node
'use strict';

/**
 * Binary to run a pg server.
 * (C) 2015 Alex Fernández.
 */

// requires
var stdio = require('stdio');
var loadtest = require('../lib/loadtest.js');
var packageJson = require(__dirname + '/../package.json');


// init
var options = stdio.getopt({
	version: {key: 'v', description: 'Display version and quit'},
	host: {key: 'h', args: 1, description: 'Host to connect to'},
	concurrency: {key: 'c', args: 1, description: 'Number of simultaneous clients'},
	number: {key: 'n', args: 1, description: 'Total number of queries'},
	query: {key: 'q', args: 1, description: 'Query to run', default: 'select current_user'},
});
if (options.version)
{
	console.log('Loadtest version: %s', packageJson.version);
	process.exit(0);
}
if (!options.args || options.args.length != 1)
{
	console.error('Missing PostgreSQL address to loadtest');
	options.printHelp();
	process.exit(1);
}
options.address = options.args[0];
loadtest.run(options, function(error, totals)
{
	if (error)
	{
		return console.error('Could not loadtest server on %s: %s', options.address, error);
	}
	console.log('Load test to %s: %s', options.address, totals);
});

