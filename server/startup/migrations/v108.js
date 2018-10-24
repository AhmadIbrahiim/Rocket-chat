RocketChat.Migrations.add({
	version: 108,
	up() {
		const roles = RocketChat.models.Roles.find({
			_id: { $ne: 'guest' },
			scope: 'Users',
		}).fetch().map((role) => role._id);
		RocketChat.models.Permissions.createOrUpdate('leave-c', roles);
		RocketChat.models.Permissions.createOrUpdate('leave-d', roles);
	},
});
