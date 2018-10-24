Meteor.startup(() => {
	RocketChat.TabBar.addButton({
		groups: ['channel', 'group', 'direct'],
		id: 'clean-history',
		anonymous: true,
		i18nTitle: 'Prune_Messages',
		icon: 'trash',
		template: 'cleanHistory',
		order: 250,
		condition: () => RocketChat.authz.hasAllPermission('clean-channel-history', Session.get('openedRoom')),
	});
});
