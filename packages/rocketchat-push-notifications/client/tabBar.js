Meteor.startup(function() {
	RocketChat.TabBar.addButton({
		groups: ['channel', 'group', 'direct'],
		id: 'push-notifications',
		i18nTitle: 'Notifications_Preferences',
		icon: 'bell',
		template: 'pushNotificationsFlexTab',
		order: 100,
	});
});
