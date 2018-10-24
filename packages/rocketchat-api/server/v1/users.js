import _ from 'underscore';
import Busboy from 'busboy';

RocketChat.API.v1.addRoute('users.create', { authRequired: true }, {
	post() {
		check(this.bodyParams, {
			email: String,
			name: String,
			password: String,
			username: String,
			active: Match.Maybe(Boolean),
			roles: Match.Maybe(Array),
			joinDefaultChannels: Match.Maybe(Boolean),
			requirePasswordChange: Match.Maybe(Boolean),
			sendWelcomeEmail: Match.Maybe(Boolean),
			verified: Match.Maybe(Boolean),
			customFields: Match.Maybe(Object),
		});

		// New change made by pull request #5152
		if (typeof this.bodyParams.joinDefaultChannels === 'undefined') {
			this.bodyParams.joinDefaultChannels = true;
		}

		if (this.bodyParams.customFields) {
			RocketChat.validateCustomFields(this.bodyParams.customFields);
		}

		const newUserId = RocketChat.saveUser(this.userId, this.bodyParams);

		if (this.bodyParams.customFields) {
			RocketChat.saveCustomFieldsWithoutValidation(newUserId, this.bodyParams.customFields);
		}


		if (typeof this.bodyParams.active !== 'undefined') {
			Meteor.runAsUser(this.userId, () => {
				Meteor.call('setUserActiveStatus', newUserId, this.bodyParams.active);
			});
		}

		return RocketChat.API.v1.success({ user: RocketChat.models.Users.findOneById(newUserId, { fields: RocketChat.API.v1.defaultFieldsToExclude }) });
	},
});

RocketChat.API.v1.addRoute('users.delete', { authRequired: true }, {
	post() {
		if (!RocketChat.authz.hasPermission(this.userId, 'delete-user')) {
			return RocketChat.API.v1.unauthorized();
		}

		const user = this.getUserFromParams();

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('deleteUser', user._id);
		});

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('users.deleteOwnAccount', { authRequired: true }, {
	post() {
		const { password } = this.bodyParams;
		if (!password) {
			return RocketChat.API.v1.failure('Body parameter "password" is required.');
		}
		if (!RocketChat.settings.get('Accounts_AllowDeleteOwnAccount')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('deleteUserOwnAccount', password);
		});

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('users.getAvatar', { authRequired: false }, {
	get() {
		const user = this.getUserFromParams();

		const url = RocketChat.getURL(`/avatar/${ user.username }`, { cdn: false, full: true });
		this.response.setHeader('Location', url);

		return {
			statusCode: 307,
			body: url,
		};
	},
});

RocketChat.API.v1.addRoute('users.getPresence', { authRequired: true }, {
	get() {
		if (this.isUserFromParams()) {
			const user = RocketChat.models.Users.findOneById(this.userId);
			return RocketChat.API.v1.success({
				presence: user.status,
				connectionStatus: user.statusConnection,
				lastLogin: user.lastLogin,
			});
		}

		const user = this.getUserFromParams();

		return RocketChat.API.v1.success({
			presence: user.status,
		});
	},
});

RocketChat.API.v1.addRoute('users.info', { authRequired: true }, {
	get() {
		const { username } = this.getUserFromParams();

		let result;
		Meteor.runAsUser(this.userId, () => {
			result = Meteor.call('getFullUserData', { username, limit: 1 });
		});

		if (!result || result.length !== 1) {
			return RocketChat.API.v1.failure(`Failed to get the user data for the userId of "${ username }".`);
		}

		return RocketChat.API.v1.success({
			user: result[0],
		});
	},
});

RocketChat.API.v1.addRoute('users.list', { authRequired: true }, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-d-room')) {
			return RocketChat.API.v1.unauthorized();
		}

		const { offset, count } = this.getPaginationItems();
		const { sort, fields, query } = this.parseJsonQuery();

		const users = RocketChat.models.Users.find(query, {
			sort: sort ? sort : { username: 1 },
			skip: offset,
			limit: count,
			fields,
		}).fetch();

		return RocketChat.API.v1.success({
			users,
			count: users.length,
			offset,
			total: RocketChat.models.Users.find(query).count(),
		});
	},
});

RocketChat.API.v1.addRoute('users.register', { authRequired: false }, {
	post() {
		if (this.userId) {
			return RocketChat.API.v1.failure('Logged in users can not register again.');
		}

		// We set their username here, so require it
		// The `registerUser` checks for the other requirements
		check(this.bodyParams, Match.ObjectIncluding({
			username: String,
		}));

		// Register the user
		const userId = Meteor.call('registerUser', this.bodyParams);

		// Now set their username
		Meteor.runAsUser(userId, () => Meteor.call('setUsername', this.bodyParams.username));

		return RocketChat.API.v1.success({ user: RocketChat.models.Users.findOneById(userId, { fields: RocketChat.API.v1.defaultFieldsToExclude }) });
	},
});

RocketChat.API.v1.addRoute('users.resetAvatar', { authRequired: true }, {
	post() {
		const user = this.getUserFromParams();

		if (user._id === this.userId) {
			Meteor.runAsUser(this.userId, () => Meteor.call('resetAvatar'));
		} else if (RocketChat.authz.hasPermission(this.userId, 'edit-other-user-info')) {
			Meteor.runAsUser(user._id, () => Meteor.call('resetAvatar'));
		} else {
			return RocketChat.API.v1.unauthorized();
		}

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('users.setAvatar', { authRequired: true }, {
	post() {
		check(this.bodyParams, Match.ObjectIncluding({
			avatarUrl: Match.Maybe(String),
			userId: Match.Maybe(String),
			username: Match.Maybe(String),
		}));

		if (!RocketChat.settings.get('Accounts_AllowUserAvatarChange')) {
			throw new Meteor.Error('error-not-allowed', 'Change avatar is not allowed', {
				method: 'users.setAvatar',
			});
		}

		let user;
		if (this.isUserFromParams()) {
			user = Meteor.users.findOne(this.userId);
		} else if (RocketChat.authz.hasPermission(this.userId, 'edit-other-user-info')) {
			user = this.getUserFromParams();
		} else {
			return RocketChat.API.v1.unauthorized();
		}

		Meteor.runAsUser(user._id, () => {
			if (this.bodyParams.avatarUrl) {
				RocketChat.setUserAvatar(user, this.bodyParams.avatarUrl, '', 'url');
			} else {
				const busboy = new Busboy({ headers: this.request.headers });

				Meteor.wrapAsync((callback) => {
					busboy.on('file', Meteor.bindEnvironment((fieldname, file, filename, encoding, mimetype) => {
						if (fieldname !== 'image') {
							return callback(new Meteor.Error('invalid-field'));
						}

						const imageData = [];
						file.on('data', Meteor.bindEnvironment((data) => {
							imageData.push(data);
						}));

						file.on('end', Meteor.bindEnvironment(() => {
							RocketChat.setUserAvatar(user, Buffer.concat(imageData), mimetype, 'rest');
							callback();
						}));

					}));
					this.request.pipe(busboy);
				})();
			}
		});

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('users.update', { authRequired: true }, {
	post() {
		check(this.bodyParams, {
			userId: String,
			data: Match.ObjectIncluding({
				email: Match.Maybe(String),
				name: Match.Maybe(String),
				password: Match.Maybe(String),
				username: Match.Maybe(String),
				active: Match.Maybe(Boolean),
				roles: Match.Maybe(Array),
				joinDefaultChannels: Match.Maybe(Boolean),
				requirePasswordChange: Match.Maybe(Boolean),
				sendWelcomeEmail: Match.Maybe(Boolean),
				verified: Match.Maybe(Boolean),
				customFields: Match.Maybe(Object),
			}),
		});

		const userData = _.extend({ _id: this.bodyParams.userId }, this.bodyParams.data);

		Meteor.runAsUser(this.userId, () => RocketChat.saveUser(this.userId, userData));

		if (this.bodyParams.data.customFields) {
			RocketChat.saveCustomFields(this.bodyParams.userId, this.bodyParams.data.customFields);
		}

		if (typeof this.bodyParams.data.active !== 'undefined') {
			Meteor.runAsUser(this.userId, () => {
				Meteor.call('setUserActiveStatus', this.bodyParams.userId, this.bodyParams.data.active);
			});
		}

		return RocketChat.API.v1.success({ user: RocketChat.models.Users.findOneById(this.bodyParams.userId, { fields: RocketChat.API.v1.defaultFieldsToExclude }) });
	},
});

RocketChat.API.v1.addRoute('users.updateOwnBasicInfo', { authRequired: true }, {
	post() {
		check(this.bodyParams, {
			data: Match.ObjectIncluding({
				email: Match.Maybe(String),
				name: Match.Maybe(String),
				username: Match.Maybe(String),
				currentPassword: Match.Maybe(String),
				newPassword: Match.Maybe(String),
			}),
			customFields: Match.Maybe(Object),
		});

		const userData = {
			email: this.bodyParams.data.email,
			realname: this.bodyParams.data.name,
			username: this.bodyParams.data.username,
			newPassword: this.bodyParams.data.newPassword,
			typedPassword: this.bodyParams.data.currentPassword,
		};

		Meteor.runAsUser(this.userId, () => Meteor.call('saveUserProfile', userData, this.bodyParams.customFields));

		return RocketChat.API.v1.success({ user: RocketChat.models.Users.findOneById(this.userId, { fields: RocketChat.API.v1.defaultFieldsToExclude }) });
	},
});

RocketChat.API.v1.addRoute('users.createToken', { authRequired: true }, {
	post() {
		const user = this.getUserFromParams();
		let data;
		Meteor.runAsUser(this.userId, () => {
			data = Meteor.call('createToken', user._id);
		});
		return data ? RocketChat.API.v1.success({ data }) : RocketChat.API.v1.unauthorized();
	},
});

RocketChat.API.v1.addRoute('users.getPreferences', { authRequired: true }, {
	get() {
		const user = RocketChat.models.Users.findOneById(this.userId);
		if (user.settings) {
			const { preferences } = user.settings;
			preferences.language = user.language;

			return RocketChat.API.v1.success({
				preferences,
			});
		} else {
			return RocketChat.API.v1.failure(TAPi18n.__('Accounts_Default_User_Preferences_not_available').toUpperCase());
		}
	},
});

RocketChat.API.v1.addRoute('users.setPreferences', { authRequired: true }, {
	post() {
		check(this.bodyParams, {
			userId: Match.Maybe(String),
			data: Match.ObjectIncluding({
				newRoomNotification: Match.Maybe(String),
				newMessageNotification: Match.Maybe(String),
				clockMode: Match.Maybe(Number),
				useEmojis: Match.Maybe(Boolean),
				convertAsciiEmoji: Match.Maybe(Boolean),
				saveMobileBandwidth: Match.Maybe(Boolean),
				collapseMediaByDefault: Match.Maybe(Boolean),
				autoImageLoad: Match.Maybe(Boolean),
				emailNotificationMode: Match.Maybe(String),
				unreadAlert: Match.Maybe(Boolean),
				notificationsSoundVolume: Match.Maybe(Number),
				desktopNotifications: Match.Maybe(String),
				mobileNotifications: Match.Maybe(String),
				enableAutoAway: Match.Maybe(Boolean),
				highlights: Match.Maybe(Array),
				desktopNotificationDuration: Match.Maybe(Number),
				messageViewMode: Match.Maybe(Number),
				hideUsernames: Match.Maybe(Boolean),
				hideRoles: Match.Maybe(Boolean),
				hideAvatars: Match.Maybe(Boolean),
				hideFlexTab: Match.Maybe(Boolean),
				sendOnEnter: Match.Maybe(String),
				roomCounterSidebar: Match.Maybe(Boolean),
				language: Match.Maybe(String),
				sidebarShowFavorites: Match.Optional(Boolean),
				sidebarShowUnread: Match.Optional(Boolean),
				sidebarSortby: Match.Optional(String),
				sidebarViewMode: Match.Optional(String),
				sidebarHideAvatar: Match.Optional(Boolean),
				sidebarGroupByType: Match.Optional(Boolean),
				muteFocusedConversations: Match.Optional(Boolean),
			}),
		});

		const userId = this.bodyParams.userId ? this.bodyParams.userId : this.userId;
		const userData = {
			_id: userId,
			settings: {
				preferences: this.bodyParams.data,
			},
		};

		if (this.bodyParams.data.language) {
			const { language } = this.bodyParams.data;
			delete this.bodyParams.data.language;
			userData.language = language;
		}

		Meteor.runAsUser(this.userId, () => RocketChat.saveUser(this.userId, userData));

		return RocketChat.API.v1.success({
			user: RocketChat.models.Users.findOneById(userId, {
				fields: {
					'settings.preferences': 1,
				},
			}),
		});
	},
});

RocketChat.API.v1.addRoute('users.forgotPassword', { authRequired: false }, {
	post() {
		const { email } = this.bodyParams;
		if (!email) {
			return RocketChat.API.v1.failure('The \'email\' param is required');
		}

		const emailSent = Meteor.call('sendForgotPasswordEmail', email);
		if (emailSent) {
			return RocketChat.API.v1.success();
		}
		return RocketChat.API.v1.failure('User not found');
	},
});

RocketChat.API.v1.addRoute('users.getUsernameSuggestion', { authRequired: true }, {
	get() {
		const result = Meteor.runAsUser(this.userId, () => Meteor.call('getUsernameSuggestion'));

		return RocketChat.API.v1.success({ result });
	},
});

RocketChat.API.v1.addRoute('users.generatePersonalAccessToken', { authRequired: true }, {
	post() {
		const { tokenName } = this.bodyParams;
		if (!tokenName) {
			return RocketChat.API.v1.failure('The \'tokenName\' param is required');
		}
		const token = Meteor.runAsUser(this.userId, () => Meteor.call('personalAccessTokens:generateToken', { tokenName }));

		return RocketChat.API.v1.success({ token });
	},
});

RocketChat.API.v1.addRoute('users.regeneratePersonalAccessToken', { authRequired: true }, {
	post() {
		const { tokenName } = this.bodyParams;
		if (!tokenName) {
			return RocketChat.API.v1.failure('The \'tokenName\' param is required');
		}
		const token = Meteor.runAsUser(this.userId, () => Meteor.call('personalAccessTokens:regenerateToken', { tokenName }));

		return RocketChat.API.v1.success({ token });
	},
});

RocketChat.API.v1.addRoute('users.getPersonalAccessTokens', { authRequired: true }, {
	get() {
		if (!RocketChat.settings.get('API_Enable_Personal_Access_Tokens')) {
			throw new Meteor.Error('error-personal-access-tokens-are-current-disabled', 'Personal Access Tokens are currently disabled');
		}
		const loginTokens = RocketChat.models.Users.getLoginTokensByUserId(this.userId).fetch()[0];
		const getPersonalAccessTokens = () => loginTokens.services.resume.loginTokens
			.filter((loginToken) => loginToken.type && loginToken.type === 'personalAccessToken')
			.map((loginToken) => ({
				name: loginToken.name,
				createdAt: loginToken.createdAt,
				lastTokenPart: loginToken.lastTokenPart,
			}));

		return RocketChat.API.v1.success({
			tokens: getPersonalAccessTokens(),
		});
	},
});

RocketChat.API.v1.addRoute('users.removePersonalAccessToken', { authRequired: true }, {
	post() {
		const { tokenName } = this.bodyParams;
		if (!tokenName) {
			return RocketChat.API.v1.failure('The \'tokenName\' param is required');
		}
		Meteor.runAsUser(this.userId, () => Meteor.call('personalAccessTokens:removeToken', {
			tokenName,
		}));

		return RocketChat.API.v1.success();
	},
});
