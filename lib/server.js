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
var prototypes = require('prototypes');
var EventEmitter = require('events').EventEmitter;

// globals
var log = new Log('info');


/**
 * Start a pg server.
 */
exports.start = function(options, callback)
{
	if (options.silent)
	{
		log = new Log('notice');
		pooled.setLogLevel('notice');
	}
	else if (options.debug)
	{
		log = new Log('debug');
		pooled.setLogLevel('debug');
	}
	var server = new Server(options);
	server.start(callback);
	return server;
};

exports.end = function()
{
	pooled.end();
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
	var pending;
	var received;

	self.init = function(socket)
	{
		log.debug('Initing socket');
		socket.setNoDelay();
		socket.on('data', receive);
		socket.on('error', handle);
		self.socket = socket;
	};

	function receive(data)
	{
		data = String(data);
		if (pending)
		{
			return processPending(data);
		}
		if (!data.contains('\n'))
		{
			return sendError('Message does not contain length');
		}
		var length = data.substringUpTo('\n');
		if (!prototypes.isNumber(length))
		{
			return sendError('Invalid message length ' + length);
		}
		pending = parseInt(length);
		received = '';
		return processPending(data.substringFrom('\n'));
	}

	function processPending(data)
	{
		received += data;
		pending -= data.length;
		if (pending > 0)
		{
			return;
		}
		return parse(received);
	}

	function parse(data)
	{
		var start = profiler.start();
		var message;
		try
		{
			message = JSON.parse(data);
		}
		catch(exception)
		{
			return sendError('Could not parse message: %s', exception);
		}
		send(message, function(error, result)
		{
			if (error)
			{
				return sendError('Could not run query ' + message.query + ' (' +
					message.params + ': ' + error);
			}
			var response = JSON.stringify(result);
			profiler.measureFrom(start, 'server', 1000);
			self.socket.write(response);
		});
	}

	function sendError(error)
	{
		log.error('%s', error);
		self.socket.write('{"error": "' + error + '"}');
		self.close();
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
	};
};

function testConnection(callback)
{
	var connection = new Connection({test: true});
	var socket = new EventEmitter();
	socket.setNoDelay = function() {};
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
	socket.emit('data', '32\n{"query":"select current_user;"}');
}

function testPartialMessage(callback)
{
	var connection = new Connection({test: true});
	var socket = new EventEmitter();
	socket.setNoDelay = function() {};
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
	socket.emit('data', '2\n');
	socket.emit('data', '{}');
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = [
		testStart,
		testConnection,
		testPartialMessage,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	log = new Log('debug');
	exports.test(testing.show);
}

