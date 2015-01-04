[![Build Status](https://secure.travis-ci.org/alexfernandez/pooled-pg.png)](http://travis-ci.org/alexfernandez/pooled-pg)

# pooled-pg

A driver to PostgreSQL that is compatible with [pg](https://github.com/brianc/node-postgres/),
with more effective pooling strategies.

## Installation

Use npm:

    $ npm install pooled-pg

To run as a server, please install globally:

    $ sudo npm install -g pooled-pg

## Basic Usage

Basic usage is as simple as with [pg](https://github.com/brianc/node-postgres/):

Since pooled-pg is designed to be compatible with pg, just replace `pg` with `pooled`
and voilà!

### `pg.connect()`

In the following line, change `pg`:

    pg.connect(address, callback);

to `pooled`, so that it looks like this:

    pooled.connect(address, callback);

Full example:

```
var pooled = require('pooled-pg');
var address = 'postgresql://user:password@server:port/database';
pooled.connect(address, function(error, client, done)
{
	client.query('select current_user', function(error, result)
	{
		done();
		console.log('Current user: %s', result.rows[0].current_user);
	});
});
```

### `pg.Client()`

If you were using pg `Client`, use now a `PooledClient`:

    var client = new pooled.Client(address);

The rest of you code will remain the same. Your connections are now pooled!

## Advanced Usage

Sometimes the normal usage for the [pg](https://github.com/brianc/node-postgres/) driver is not enough.
If you have more than a few hundred connections, PostgreSQL does not behave nicely.
In those situations pooled-pg has a new, more interesting usage mode:
install a daemon on the PostgreSQL server which pools the connections,
and use a remote light client that connects to the daemon.

## License

This package is published under the MIT license.
You can integrate it in any commercial, closed software and/or make changes to the code with complete liberty.
If you send your changes back to the main repo we will be grateful,
but it is by no means required.


