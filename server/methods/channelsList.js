import _ from 'underscore';
import s from 'underscore.string';

Meteor.methods({
	channelsList(filter, channelType, limit, sort) {
		this.unblock();

		check(filter, String);
		check(channelType, String);
		check(limit, Match.Optional(Number));
		check(sort, Match.Optional(String));

		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'channelsList',
			});
		}

		const options = {
			fields: {
				name: 1,
				t: 1,
			},
			sort: {
				msgs: -1,
			},
		};

		if (_.isNumber(limit)) {
			options.limit = limit;
		}

		if (s.trim(sort)) {
			switch (sort) {
				case 'name':
					options.sort = {
						name: 1,
					};
					break;
				case 'msgs':
					options.sort = {
						msgs: -1,
					};
			}
		}

		let channels = [];

		const userId = Meteor.userId();

		if (channelType !== 'private') {
			if (RocketChat.authz.hasPermission(userId, 'view-c-room')) {
				if (filter) {
					channels = channels.concat(RocketChat.models.Rooms.findByType('c', options).fetch());
				} else {
					channels = channels.concat(RocketChat.models.Rooms.findByTypeAndNameContaining('c', filter, options).fetch());
				}
			} else if (RocketChat.authz.hasPermission(userId, 'view-joined-room')) {
				const roomIds = RocketChat.models.Subscriptions.findByTypeAndUserId('c', userId, { fields: { rid: 1 } }).fetch().map((s) => s.rid);
				if (filter) {
					channels = channels.concat(RocketChat.models.Rooms.findByTypeInIds('c', roomIds, options).fetch());
				} else {
					channels = channels.concat(RocketChat.models.Rooms.findByTypeInIdsAndNameContaining('c', roomIds, filter, options).fetch());
				}
			}
		}

		if (channelType !== 'public' && RocketChat.authz.hasPermission(userId, 'view-p-room')) {
			const user = RocketChat.models.Users.findOne(userId, {
				fields: {
					username: 1,
					'settings.preferences.sidebarGroupByType': 1,
				},
			});
			const userPref = RocketChat.getUserPreference(user, 'sidebarGroupByType');
			// needs to negate globalPref because userPref represents its opposite
			const groupByType = userPref !== undefined ? userPref : RocketChat.settings.get('UI_Group_Channels_By_Type');

			if (!groupByType) {
				const roomIds = RocketChat.models.Subscriptions.findByTypeAndUserId('p', userId, { fields: { rid: 1 } }).fetch().map((s) => s.rid);
				if (filter) {
					channels = channels.concat(RocketChat.models.Rooms.findByTypeInIds('p', roomIds, options).fetch());
				} else {
					channels = channels.concat(RocketChat.models.Rooms.findByTypeInIdsAndNameContaining('p', roomIds, filter, options).fetch());
				}
			}
		}

		return {
			channels,
		};
	},
});
