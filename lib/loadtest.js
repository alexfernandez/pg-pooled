'use strict';

/**
 * Load-test the pooled server.
 * (C) 2015 Alex Fernández.
 */

// requires
//var server = require('./server.js');
var remote = require('./remote.js');
var testing = require('testing');


/**
 * Load-test a server.
 */
exports.run = function(options, callback)
{
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
		var total = options.number / concurrency;
		options.finish = function(error, value)
		{
			finished.push(value);
			if (finished.length == concurrency)
			{
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
		self.target = target;
		setImmediate(query);
	};

	function query()
	{
		remote.remoteConnect(options.address, function(error, client, done)
		{
			client.query(options.query, options.params, function(error)
			{
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
					console.log('Run %s times', self.current);
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

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = [
		testLoadtester,
		testWorker,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	exports.test(testing.show);
}

