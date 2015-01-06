'use strict';

/**
 * A server that listens to requests and serves them using pg.
 * (C) 2015 Alex Fernández.
 */

// requires
var pooled = require('./pooled.js');
var net = require('net');
var Log = require('log');
var testing = require('testing');
var profiler = require('microprofiler');
var EventEmitter = require('events').EventEmitter;

// globals
var log = new Log('info');


/**
 * Start a pg server.
 */
exports.start = function(options, callback)
{
	var server = new Server(options);
	server.start(callback);
	return server;
};

var Server = function(options)
{
	// self-reference
	var self = this;

	// attributes
	var server;
	var connections = [];

	self.start = function(callback)
	{
		server = net.createServer(function(socket)
		{
			var connection = new Connection(options);
			connections.push(connection);
			connection.init(socket);
		});
		server.listen(options.port, function(error)
		{
			if (error)
			{
				return callback(error);
			}
			return callback(null, self);
		});
	};

	self.close = function(callback)
	{
		connections.forEach(function(connection)
		{
			connection.close();
		});
		server.close(callback);
	};
};

function testStart(callback)
{
	var options = {
		port: 5445,
		test: true,
	};
	exports.start(options, function(error, server)
	{
		testing.check(error, 'Could not start server', callback);
		server.close(function(error)
		{
			testing.check(error, 'Could not close server', callback);
			testing.success(callback);
		});
	});
}

var Connection = function(options)
{
	// self-reference
	var self = this;

	// attributes
	self.socket = null;

	self.init = function(socket)
	{
		socket.on('data', receive);
		socket.on('error', handle);
		self.socket = socket;
	};

	function receive(data)
	{
		var start = profiler.start();
		var message = JSON.parse(data);
		send(message, function(error, result)
		{
			if (error)
			{
				log.error('Could not run query %s (%s): %s', message.query, message.params, error);
				return self.socket.write('{"error": "' + error + '"}');
			}
			var response = JSON.stringify(result);
			profiler.measureFrom(start, 'server', 1000);
			self.socket.write(response);
		});
	}

	function send(message, callback)
	{
		var address = message.address || options.address;
		if (options.test)
		{
			address = 'test';
		}
		pooled.pooledConnect(address, function(error, client, done)
		{
			if (error)
			{
				return callback(error);
			}
			client.query(message.query, message.params, function(error, result)
			{
				done();
				callback(error, result);
			});
		});
	}

	function handle(error)
	{
		log.error('Error %s', error);
		self.close();
	}

	self.close = function()
	{
		self.socket.end();
		pooled.end();
	};
};

function testConnection(callback)
{
	var connection = new Connection({test: true});
	var socket = new EventEmitter();
	connection.init(socket);
	socket.write = function(message)
	{
		log.debug('Sending %s', message);
		connection.close();
	};
	socket.end = function()
	{
		testing.success(callback);
	};
	socket.emit('data', '{"query":"select current_user;"}');
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = [
		testStart,
		testConnection,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	log = new Log('debug');
	exports.test(testing.show);
}

