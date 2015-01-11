'use strict';

/**
 * A server that listens to requests and serves them using pg.
 * (C) 2015 Alex Fernández.
 */

// requires
require('prototypes');
var net = require('net');
var Log = require('log');
var testing = require('testing');
var profiler = require('microprofiler');
var EventEmitter = require('events').EventEmitter;
var pooled = require('./pooled.js');
var protocol = require('./protocol.js');

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
	var parser = new protocol.Parser();

	self.init = function(socket)
	{
		log.debug('Initing socket');
		socket.setNoDelay();
		socket.on('data', receive);
		socket.on('error', handle);
		self.socket = socket;
		parser.on('data', processMessage);
		parser.on('error', sendError);
	};

	function receive(data)
	{
		parser.receive(String(data));
	}

	function processMessage(message)
	{
		var start = profiler.start();
		send(message, function(error, result)
		{
			if (error)
			{
				return sendError('Could not run query ' + message.query + ' (' +
					message.params + ': ' + error);
			}
			profiler.measureFrom(start, 'server', 1000);
			self.socket.write(protocol.createData(result));
		});
	}

	function sendError(error)
	{
		log.error('%s', error);
		var message = {error: error};
		self.socket.write(protocol.createData(message));
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

