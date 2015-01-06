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
	
	function connect(callback)
	{
		var fullHost = address.substringFrom('@').substringUpTo('/');
		var options = {
			host: fullHost.substringUpTo(':'),
			port: fullHost.substringFrom(':'),
		};
		var socket = net.connect(options, function(error)
		{
			if (error)
			{
				return callback(error);
			}
			socket.setNoDelay();
			return callback(null, socket);
		});
	}

	self.query = function(query, params, callback)
	{
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
		connect(function(error, socket)
		{
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
				if (error)
				{
					return callback('Could not connect: ' + error);
				}
				socket.on('data', function(data)
				{
					socket.end();
					return callback(null, JSON.parse(data));
				});
				socket.on('error', function(error)
				{
					return callback('Could not receive data: ' + error);
				});
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
	};
};

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

