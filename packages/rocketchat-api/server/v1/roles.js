RocketChat.API.v1.addRoute('roles.list', { authRequired: true }, {
	get() {
		const roles = RocketChat.models.Roles.find({}, { fields: { _updatedAt: 0 } }).fetch();

		return RocketChat.API.v1.success({ roles });
	},
});

RocketChat.API.v1.addRoute('roles.create', { authRequired: true }, {
	post() {
		check(this.bodyParams, {
			name: String,
			scope: Match.Maybe(String),
			description: Match.Maybe(String),
		});

		const roleData = {
			name: this.bodyParams.name,
			scope: this.bodyParams.scope,
			description: this.bodyParams.description,
		};

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('authorization:saveRole', roleData);
		});

		return RocketChat.API.v1.success({
			role: RocketChat.models.Roles.findOneByIdOrName(roleData.name, { fields: RocketChat.API.v1.defaultFieldsToExclude }),
		});
	},
});

RocketChat.API.v1.addRoute('roles.addUserToRole', { authRequired: true }, {
	post() {
		check(this.bodyParams, {
			roleName: String,
			username: String,
			roomId: Match.Maybe(String),
		});

		const user = this.getUserFromParams();

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('authorization:addUserToRole', this.bodyParams.roleName, user.username, this.bodyParams.roomId);
		});

		return RocketChat.API.v1.success({
			role: RocketChat.models.Roles.findOneByIdOrName(this.bodyParams.roleName, { fields: RocketChat.API.v1.defaultFieldsToExclude }),
		});
	},
});
