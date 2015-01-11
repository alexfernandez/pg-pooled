'use strict';

/**
 * Protocol to send messages down the socket and parse them.
 * (C) 2015 Alex Fernández.
 */

// requires
var Log = require('log');
var util = require('util');
var events = require('events');
var testing = require('testing');
var prototypes = require('prototypes');

// globals
var log = new Log('info');


exports.createData = function(message)
{
	var stringified = JSON.stringify(message);
	return stringified.length + '\n' + stringified;
};

exports.Parser = function()
{
	// self-reference
	var self = this;
	events.EventEmitter.call(self);

	// attributes
	var pending = 0;
	var received = null;

	self.receive = function(data)
	{
		if (pending)
		{
			return processPending(data);
		}
		if (!data.contains('\n'))
		{
			return self.emit('error', 'Message does not contain length');
		}
		var length = data.substringUpTo('\n');
		if (!prototypes.isNumber(length))
		{
			return self.emit('error', 'Invalid message length ' + length);
		}
		pending = parseInt(length);
		received = '';
		return processPending(data.substringFrom('\n'));
	};

	function processPending(data)
	{
		received += data;
		pending -= data.length;
		if (pending > 0)
		{
			return;
		}
		var message;
		try
		{
			message = JSON.parse(received);
		}
		catch(exception)
		{
			return self.emit('error', 'Could not parse message: ' + exception);
		}
		self.emit('data', message);
		pending = 0;
		received = null;
	}
};
util.inherits(exports.Parser, events.EventEmitter);

function testParser(callback)
{
	var parser = new exports.Parser();
	parser.on('data', function(message)
	{
		testing.assertEquals(message, {}, 'Invalid message', callback);
		testing.success(callback);
	});
	parser.on('error', function(error)
	{
		testing.fail('Parser error: %s', error, callback);
	});
	parser.receive('2\n{}');
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = [
		testParser,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	log = new Log('debug');
	exports.test(testing.show);
}

