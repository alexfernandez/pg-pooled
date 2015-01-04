'use strict';

/**
 * A pooled connection to PostgreSQL using pg.
 * (C) 2015 Alex Fernández.
 */

// requires
var pg = require('pg');
var testing = require('testing');

// constants
var TEST_ADDRESS = 'postgresql://test:test@localhost:5432/test';

exports.pooledConnect = function(address, callback)
{
	var client = new exports.PooledClient(address);
	callback(null, client, client.done);
};

exports.end = function()
{
	pg.end();
};

exports.PooledClient = function(address)
{
	// self-reference
	var self = this;

	// attributes

	self.query = function(query, params, callback)
	{
		if (typeof params == 'function')
		{
			callback = params;
			params = null;
		}
		pg.connect(address, function(error, client, done)
		{
			if (error)
			{
				return callback('Could not connect to  ' + address + ': ' + error);
			}
			client.query(query, params, function(error, result)
			{
				done();
				if (error)
				{
					return callback('Could not run query ' + query + ': ' + error);
				}
				return callback(null, result);
			});
		});
	};

	self.done = function()
	{
	};

	self.end = function()
	{
		pg.end();
	};
};

function testPooledClient(callback)
{
	var client = new exports.PooledClient(TEST_ADDRESS);
	client.query('select current_user', function(error)
	{
		testing.check(error, 'Could not run query to %s', TEST_ADDRESS, callback);
		client.end();
		testing.success(callback);
	});
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = [
		testPooledClient,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	exports.test(testing.show);
}

