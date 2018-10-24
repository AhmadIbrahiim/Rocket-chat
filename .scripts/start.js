#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const extend = require('util')._extend;
const { exec } = require('child_process');
const processes = [];

const baseDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(baseDir);

const appOptions = {
	env: {
		PORT: 3000,
		ROOT_URL: 'http://localhost:3000',
	},
};

function startProcess(opts, callback) {
	const proc = exec(
		opts.command,
		opts.options
	);

	if (opts.waitForMessage) {
		proc.stdout.on('data', function waitForMessage(data) {
			if (data.toString().match(opts.waitForMessage)) {
				if (callback) {
					callback();
				}
			}
		});
	}

	if (!opts.silent) {
		proc.stdout.pipe(process.stdout);
		proc.stderr.pipe(process.stderr);
	}

	if (opts.logFile) {
		const logStream = fs.createWriteStream(opts.logFile, { flags: 'a' });
		proc.stdout.pipe(logStream);
		proc.stderr.pipe(logStream);
	}

	proc.on('close', function(code) {
		console.log(opts.name, `exited with code ${ code }`);
		for (let i = 0; i < processes.length; i += 1) {
			processes[i].kill();
		}
		process.exit(code);
	});
	processes.push(proc);
}

function startApp(callback) {
	startProcess({
		name: 'Meteor App',
		command: 'node /tmp/build-test/bundle/main.js',
		waitForMessage: appOptions.waitForMessage,
		options: {
			cwd: srcDir,
			env: extend(appOptions.env, process.env),
		},
	}, callback);
}

function startChimp() {
	startProcess({
		name: 'Chimp',
		command: 'npm run chimp-test',
		options: {
			env: Object.assign({}, process.env, {
				NODE_PATH: `${ process.env.NODE_PATH +
					path.delimiter + srcDir +
					path.delimiter + srcDir }/node_modules`,
			}),
		},
	});
}

function chimpNoMirror() {
	appOptions.waitForMessage = 'SERVER RUNNING';
	startApp(function() {
		startChimp();
	});
}

chimpNoMirror();
