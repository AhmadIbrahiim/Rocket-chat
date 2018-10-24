Meteor.startup(function() {
	RocketChat.settings.add('Message_AllowPinning', true, {
		type: 'boolean',
		group: 'Message',
		public: true,
	});
	return RocketChat.models.Permissions.upsert('pin-message', {
		$setOnInsert: {
			roles: ['owner', 'moderator', 'admin'],
		},
	});
});
