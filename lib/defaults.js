'use strict';

/**
 * Default values, can be modified by the user.
 * (C) 2015 Alex Fernández.
 */

// requires
require('prototypes');


/**
 * Default values for defaults.
 */
module.exports = {
	user: process.env.USER,
	database: process.env.USER,
	password: null,
	host: 'localhost',
	port: 5432,
	rows: 0,
	poolSize: 10,
	poolIdleTimeout: 30000,
	reapIntervalMillis: 1000,
	binary: false,
	parseInt8: null,
};


