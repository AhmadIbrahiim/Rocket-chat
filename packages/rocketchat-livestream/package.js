Package.describe({
	name: 'rocketchat:livestream',
	version: '0.0.5',
	summary: 'Embed livestream to Rocket.Chat channels',
	git: '',
});

Package.onUse(function(api) {
	api.use('templating', 'client');
	api.use([
		'ecmascript',
		'rocketchat:lib',
	]);
	api.addFiles([
		'client/views/liveStreamTab.html',
		'client/views/livestreamBroadcast.html',
		'client/views/livestreamBroadcast.js',
		'client/views/liveStreamTab.js',
		'client/views/broadcastView.html',
		'client/views/broadcastView.js',
		'client/styles/liveStreamTab.css',
		'client/views/liveStreamView.html',
		'client/views/liveStreamView.js',
		'client/tabBar.js',
	], 'client');

	api.addFiles([
		'server/index.js',
		'server/models/Rooms.js',
		'server/functions/saveStreamingOptions.js',
		'server/settings.js',
	], 'server');

	Npm.depends({
		googleapis: '25.0.0',
	});
});
