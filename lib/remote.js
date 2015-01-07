'use strict';
/* jshint camelcase: false */

/**
 * A remote client that sends request to a pooled-pg server.
 * (C) 2015 Alex Fernández.
 */

// requires
require('prototypes');
var server = require('./server.js');
var net = require('net');
var Log = require('log');
var testing = require('testing');
var genericPool = require('generic-pool');
var profiler = require('microprofiler');

// globals
var log = new Log('info');
var clients = {};


exports.remoteConnect = function(address, callback)
{
	var client = getClient(address);
	callback(null, client, client.done);
};

function getClient(address)
{
	if (!clients[address])
	{
		clients[address] = new exports.RemoteClient(address);
	}
	return clients[address];
}

exports.end = function()
{
	clients.forEach(function(client)
	{
		client.end();
	});
};

exports.RemoteClient = function(address)
{
	// self-reference
	var self = this;

	// attributes
	var pool = createPool(address);

	self.query = function(query, params, callback)
	{
		var start = profiler.start();
		log.debug('query: %s', query);
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
		pool.acquire(function(error, socket)
		{
			profiler.measureFrom(start, 'acquired');
			if (error)
			{
				return callback('Could not connect to  ' + address + ': ' + error);
			}
			var message = {
				query: query,
				params: params,
				address: getLocalAddress(),
			};
			socket.write(JSON.stringify(message), function(error)
			{
				profiler.measureFrom(start, 'written');
				if (error)
				{
					return callback('Could not connect: ' + error);
				}
			});
			socket.once('data', function(data)
			{
				pool.release(socket);
				profiler.measureFrom(start, 'data');
				try
				{
					return callback(null, JSON.parse(data));
				}
				catch(exception)
				{
					return callback('Could not parse response: ' + exception);
				}
			});
		});
	};

	function getLocalAddress()
	{
		var withoutProtocol = address.substringFrom(':').substringUpTo('@');
		var database = address.substringFrom('@').substringFrom('/');
		return 'postgresql:' + withoutProtocol + '@localhost:5432/' + database;
	}

	self.done = function()
	{
	};

	self.end = function()
	{
		profiler.show('acquired');
		profiler.show('written');
		profiler.show('data');
	};
};

function createPool(address)
{
	var fullHost = address.substringFrom('@').substringUpTo('/');
	log.debug('Creating client to %s', fullHost);
	var options = {
		host: fullHost.substringUpTo(':'),
		port: fullHost.substringFrom(':'),
	};
	var pool = genericPool.Pool({
		name: 'remote',
		create: function(callback)
		{
			log.debug('Creating socket to %s', fullHost);
			var socket = net.connect(options, function(error)
			{
				if (error)
				{
					return callback(error);
				}
				socket.setNoDelay();
				socket.on('error', function(error)
				{
					log.error('Error in remote, removing from pool: %s', error);
					pool.destroy(socket);
				});
				return callback(null, socket);
			});
		},
		destroy: function(client)
		{
			log.debug('Destroying socket to %s', fullHost);
			client.end();
		},
		max: 50,
		idleTimeoutMillis: 1000,
	});
	return pool;
}

function testRemoteClient(callback)
{
	var port = 5444;
	var address = 'pooled://test:test@localhost: ' + port +  '/test';
	var options = {
		port: port,
		test: true,
	};
	server.start(options, function(error, testServer)
	{
		var client = new exports.RemoteClient(address);
		client.query('select current_user', function(error, result)
		{
			testing.check(error, 'Could not run query to %s', address, callback);
			testing.assert(result, 'No result', callback);
			testing.assert(result.rowCount, 'No rows', callback);
			testing.assert(result.rows[0], 'No first row', callback);
			var user = result.rows[0].current_user;
			testing.assertEquals(user, 'test', 'Invalid user', callback);
			client.end();
			testServer.close(function(error)
			{
				testing.check(error, 'Could not close server', callback);
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
		testRemoteClient,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	log = new Log('debug');
	exports.test(testing.show);
}

