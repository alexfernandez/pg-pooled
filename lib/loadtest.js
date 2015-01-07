'use strict';

/**
 * Load-test the pooled server.
 * (C) 2015 Alex Fernández.
 */

// requires
var server = require('./server.js');
var remote = require('./remote.js');
var Log = require('log');
var testing = require('testing');
var profiler = require('microprofiler');

// globals
var log = new Log('info');


/**
 * Load-test a server.
 */
exports.run = function(options, callback)
{
	if (options.silent)
	{
		log = new Log('notice');
	}
	else if (options.debug)
	{
		log = new Log('debug');
	}
	var tester = new Loadtester(options);
	tester.run(callback);
};

var Loadtester = function(options)
{
	// self-reference
	var self = this;

	// attributes
	var workers = [];
	var finished = [];

	self.run = function(callback)
	{
		var concurrency = options.concurrency || 1;
		log.debug('Concurrency %s', concurrency);
		var total = options.number / concurrency;
		options.finish = function(error, value)
		{
			finished.push(value);
			if (finished.length == concurrency)
			{
				remote.end();
				profiler.show('loadtest');
				return callback(null, finished);
			}
		};
		for (var i = 0; i < concurrency; i++)
		{
			var worker = new Worker(options);
			workers.push(worker);
			worker.start(total);
		}
	};
};

function testLoadtester(callback)
{
	var options = {
		number: 10,
		address: 'test',
	};
	var loadtester = new Loadtester(options);
	loadtester.run(function(error, totals)
	{
		testing.check(error, 'Could not run', callback);
		testing.assertEquals(totals, [10], 'Invalid totals', callback);
		testing.success(callback);
	});
}

var Worker = function(options)
{
	// self-reference
	var self = this;

	// attributes
	self.current = 0;
	self.errors = 0;
	self.target = 0;

	self.start = function(target)
	{
		log.debug('Starting worker for %s iterations', target);
		self.target = target;
		setImmediate(query);
	};

	function query()
	{
		var start = profiler.start();
		remote.remoteConnect(options.address, function(error, client, done)
		{
			client.query(options.query, options.params, function(error)
			{
				profiler.measureFrom(start, 'loadtest', 1000);
				done();
				if (error)
				{
					self.errors += 1;
				}
				else
				{
					self.current += 1;
				}
				if (self.target && self.current >= self.target)
				{
					log.info('Run %s times', self.current);
					if (options.finish)
					{
						return options.finish(null, self.current);
					}
					return;
				}
				setImmediate(query);
			});
		});
	}
};

function testWorker(callback)
{
	var options = {
		address: 'test',
		finish: function(error, total)
		{
			testing.check(error, 'Worker error', callback);
			testing.assertEquals(total, 10, 'Invalid total', callback);
			testing.success(callback);
		},
	};
	var worker = new Worker(options);
	worker.start(10);
}

function loadtestServer(callback)
{
	var options = {
		port: 5453,
		test: true,
	};
	server.start(options, function(error, testServer)
	{
		testing.check(error, 'Could not start server', callback);
		options = {
			concurrency: 5,
			number: 50,
			address: 'postgres://test:test@localhost:5453/test',
			query: 'select current_user;',
		};
		exports.run(options, function(error, totals)
		{
			testing.check(error, 'Could not stop server', callback);
			var expected = [10, 10, 10, 10, 10];
			testing.assertEquals(totals, expected, 'Invalid totals', callback);
			testServer.close(function(error)
			{
				testing.check(error, 'Could not stop server', callback);
				testing.success(callback);
			});
		});
	});
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = [
		testLoadtester,
		testWorker,
		loadtestServer,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	log = new Log('debug');
	exports.test(testing.show);
}

