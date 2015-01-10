'use strict';

/**
 * Connect to a pg server, either pooled or remote.
 * (C) 2015 Alex Fernández.
 */

// requires
require('prototypes');
var remote = require('./remote.js');
var pooled = require('./pooled.js');
var Log = require('log');
var testing = require('testing');

// globals
var log = new Log('info');


exports.connect = function(address, callback)
{
	if (address.startsWith('remote:'))
	{
		return remote.remoteConnect(address, callback);
	}
	else
	{
		return pooled.pooledConnect(address, callback);
	}
};

exports.end = function()
{
	remote.end();
	pooled.end();
};

exports.Client = function(address)
{
	// self-reference
	var self = this;

	// attributes
	var client = createClient();

	function createClient()
	{
		if (address.startsWith('remote:'))
		{
			return new remote.RemoteClient(address);
		}
		else
		{
			return new pooled.PooledClient(address);
		}
	}

	self.query = function(query, params, callback)
	{
		return client.query(query, params, callback);
	};

	self.done = function()
	{
		return client.done();
	};

	self.end = function()
	{
		return client.end();
	};
};

function testConnect(callback)
{
	var remoteAddress = 'remote://test.test@localhost:5434/test';
	var pooledAddress = 'pooled://test:test@localhost:5432/test';
	exports.connect(remoteAddress, function(error)
	{
		testing.check(error, 'Connect to remote', callback);
		exports.connect(pooledAddress, function(error)
		{
			testing.check(error, 'Connect to pooled', callback);
			var client = new exports.Client('pooled://test:test@localhost:5432/test');
			client = new exports.Client('remote://test.test@localhost:5434/test');
			testing.success(callback);
		});
	});
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = [
		testConnect,
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])  
{
	log = new Log('debug');
	exports.test(testing.show);
}

