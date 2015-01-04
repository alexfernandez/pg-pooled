'use strict';

/**
 * A server that listens to requests and serves them using pg.
 * (C) 2015 Alex Fernández.
 */

// requires
var pooled = require('./pooled.js');
var net = require('net');
var testing = require('testing');
var EventEmitter = require('events').EventEmitter;


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
		var message = JSON.parse(data);
		send(message, function(error, result)
		{
			if (error)
			{
				console.error('Could not run query %s (%s): %s', message.query, message.params, error);
				return self.socket.write('{"error": "' + error + '"}');
			}
			var response = JSON.stringify(result);
			self.socket.write(response);
		});
	}

	function send(message, callback)
	{
		if (options.test)
		{
			return sendFake(callback);
		}
		var address = message.address || options.address;
		pooled.pooledConnect(address, function(error, client, done)
		{
			client.query(message.query, message.params, function(error, result)
			{
				done();
				callback(error, result);
			});
		});
	}

	function sendFake(callback)
	{
		return callback(null, {
			rowCount: 1,
			rows: [{"current_user":"test"}],
		});
	}

	function handle(error)
	{
		console.error('Error %s', error);
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
		console.log('Sending %s', message);
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
	exports.test(testing.show);
}

