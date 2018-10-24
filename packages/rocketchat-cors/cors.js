/* globals WebAppInternals */
import _ from 'underscore';

import url from 'url';

import { Mongo } from 'meteor/mongo';
import tls from 'tls';
// FIX For TLS error see more here https://github.com/RocketChat/Rocket.Chat/issues/9316
// TODO: Remove after NodeJS fix it, more information https://github.com/nodejs/node/issues/16196 https://github.com/nodejs/node/pull/16853
tls.DEFAULT_ECDH_CURVE = 'auto';

// Revert change from Meteor 1.6.1 who set ignoreUndefined: true
// more information https://github.com/meteor/meteor/pull/9444
let mongoOptions = {
	ignoreUndefined: false,
};

const mongoOptionStr = process.env.MONGO_OPTIONS;
if (typeof mongoOptionStr !== 'undefined') {
	const jsonMongoOptions = JSON.parse(mongoOptionStr);

	mongoOptions = Object.assign({}, mongoOptions, jsonMongoOptions);
}

Mongo.setConnectionOptions(mongoOptions);

WebApp.rawConnectHandlers.use(Meteor.bindEnvironment(function(req, res, next) {
	if (req._body) {
		return next();
	}
	if (req.headers['transfer-encoding'] === undefined && isNaN(req.headers['content-length'])) {
		return next();
	}
	if (req.headers['content-type'] !== '' && req.headers['content-type'] !== undefined) {
		return next();
	}
	if (req.url.indexOf(`${ __meteor_runtime_config__.ROOT_URL_PATH_PREFIX }/ufs/`) === 0) {
		return next();
	}

	let buf = '';
	req.setEncoding('utf8');
	req.on('data', function(chunk) {
		return buf += chunk;
	});

	req.on('end', function() {
		if (RocketChat && RocketChat.debugLevel === 'debug') {
			console.log('[request]'.green, req.method, req.url, '\nheaders ->', req.headers, '\nbody ->', buf);
		}

		try {
			req.body = JSON.parse(buf);
		} catch (error) {
			req.body = buf;
		}
		req._body = true;

		return next();
	});
}));

WebApp.rawConnectHandlers.use(function(req, res, next) {
	if (/^\/(api|_timesync|sockjs|tap-i18n|__cordova)(\/|$)/.test(req.url)) {
		res.setHeader('Access-Control-Allow-Origin', '*');
	}

	const { setHeader } = res;
	res.setHeader = function(key, val, ...args) {
		if (key.toLowerCase() === 'access-control-allow-origin' && val === 'http://meteor.local') {
			return;
		}
		return setHeader.apply(this, [key, val, ...args]);
	};
	return next();
});

const _staticFilesMiddleware = WebAppInternals.staticFilesMiddleware;

WebAppInternals._staticFilesMiddleware = function(staticFiles, req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	return _staticFilesMiddleware(staticFiles, req, res, next);
};

const oldHttpServerListeners = WebApp.httpServer.listeners('request').slice(0);

WebApp.httpServer.removeAllListeners('request');

WebApp.httpServer.addListener('request', function(req, res, ...args) {
	const next = () => {
		for (const oldListener of oldHttpServerListeners) {
			oldListener.apply(WebApp.httpServer, [req, res, ...args]);
		}
	};

	if (RocketChat.settings.get('Force_SSL') !== true) {
		next();
		return;
	}

	const remoteAddress = req.connection.remoteAddress || req.socket.remoteAddress;
	const localhostRegexp = /^\s*(127\.0\.0\.1|::1)\s*$/;
	const localhostTest = function(x) {
		return localhostRegexp.test(x);
	};

	const isLocal = localhostRegexp.test(remoteAddress) && (!req.headers['x-forwarded-for'] || _.all(req.headers['x-forwarded-for'].split(','), localhostTest));
	const isSsl = req.connection.pair || (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'].indexOf('https') !== -1);

	if (RocketChat && RocketChat.debugLevel === 'debug') {
		console.log('req.url', req.url);
		console.log('remoteAddress', remoteAddress);
		console.log('isLocal', isLocal);
		console.log('isSsl', isSsl);
		console.log('req.headers', req.headers);
	}

	if (!isLocal && !isSsl) {
		let host = req.headers.host || url.parse(Meteor.absoluteUrl()).hostname;
		host = host.replace(/:\d+$/, '');
		res.writeHead(302, {
			Location: `https://${ host }${ req.url }`,
		});
		res.end();
		return;
	}

	return next();
});
