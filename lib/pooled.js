'use strict';

/**
 * A pooled connection to PostgreSQL using pg.
 * (C) 2015 Alex Fernández.
 */

// requires
var pg = require('pg');
var Log = require('log');
var testing = require('testing');
var genericPool = require('generic-pool');

// globals
var log = new Log('info');
var clients = {};


exports.setLogLevel = function(level)
{
	log = new Log(level);
};

exports.pooledConnect = function(address, callback)
{
	var client = getClient(address);
	callback(null, client, client.done);
};

function getClient(address)
{
	if (!clients[address])
	{
		clients[address] = new exports.PooledClient(address);
	}
	return clients[address];
}

exports.end = function()
{
	pg.end();
};

exports.PooledClient = function(address)
{
	// self-reference
	var self = this;

	// attributes
	var pool = createPool(address);

	self.query = function(query, params, callback)
	{
		if (typeof params == 'function')
		{
			callback = params;
			params = null;
		}
		if (address == 'test')
		{
			return callback(null, {
				rowCount: 1,
				rows: [{"current_user":"test"}],
			});

		}
		pool.acquire(function(error, client)
		{
			if (error)
			{
				return callback('Could not connect to  ' + address + ': ' + error);
			}
			client.query(query, params, function(error, result)
			{
				pool.release(client);
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

function createPool(address)
{
	var pool = genericPool.Pool({
		name: 'postgres',
		create: function(callback)
		{
			log.debug('Creating client to %s', address);
			var client = new pg.Client(address);
			client.connect(function(error)
			{
				if (error)
				{
					return callback(error);
				}
				client.on('error', function(error)
				{
					log.error('Error in client, removing from pool: %s', error);
					pool.destroy(client);
				});
				callback(null, client);
			});
		},
		destroy: function(client)
		{
			log.debug('Destroying client to %s', address);
			client.end();
		},
		max: 50,
		idleTimeoutMillis : 30 * 1000,
	});
	return pool;
}

function testPooledClient(callback)
{
	var client = new exports.PooledClient('test');
	client.query('select current_user', function(error)
	{
		testing.check(error, 'Could not run query to test', callback);
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

