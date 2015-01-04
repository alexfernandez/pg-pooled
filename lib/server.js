'use strict';

/**
 * A server that listens to requests and serves them using pg.
 * (C) 2015 Alex Fernández.
 */

// requires
var pg = require('pg');
var net = require('net');
var testing = require('testing');
var EventEmitter = require('events').EventEmitter;


/**
 * Start a pg server.
 */
exports.start = function(options, callback)
{
	var server = net.createServer(function(socket)
	{
		new Connection(options).init(socket);
	});
	server.listen(options.port);
	callback(null, server);
	return server;
};

var Connection = function(options)
{
	// self-reference
	var self = this;

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
		pg.connect(options.address, function(error, client, done)
		{
			client.query(message.query, message.params, function(error, result)
			{
				done();
				if (error)
				{
					console.error('Could not run query %s (%s): %s', message.query, message.params, error);
					return self.socket.send({
						error: error,
					});
				}
				var response = JSON.stringify(result);
				self.socket.send(response);
			});
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
	};
};

/**
 * Test that added properties do not show in enumeration.
 */
function testConnection(callback)
{
	var connection = new Connection({});
	var socket = new EventEmitter();
	connection.init(socket);
	socket.emit('data', '{"query":"select current_user;"}');
	socket.send = function(message)
	{
		console.log('Sending %s', message);
		connection.close();
	};
	socket.end = function()
	{
		testing.success(callback);
	};
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = [
		testConnection,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	exports.test(testing.show);
}

