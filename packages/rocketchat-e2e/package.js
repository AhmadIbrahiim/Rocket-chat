/* globals Package: false */

Package.describe({
	name: 'rocketchat:e2e',
	version: '0.0.1',
	summary: 'End-to-End encrypted conversations for Rocket.Chat',
	git: '',
});

Package.onUse(function(api) {
	api.use([
		'ecmascript',
		'less',
		'mizzao:timesync',
		'rocketchat:lib',
		'templating',
		'sha',
	]);

	api.mainModule('client/rocketchat.e2e.js', 'client');
	api.addFiles('client/accountEncryption.html', 'client');
	api.addFiles('client/accountEncryption.js', 'client');

	api.mainModule('server/index.js', 'server');
});
