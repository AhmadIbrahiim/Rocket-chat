Meteor.methods({
	'livechat:removeDepartment'(_id) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'livechat:removeDepartment' });
		}

		return RocketChat.Livechat.removeDepartment(_id);
	},
});
