Meteor.methods({
	createDirectMessage(username) {
		check(username, String);

		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'createDirectMessage',
			});
		}

		const me = Meteor.user();

		if (!me.username) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'createDirectMessage',
			});
		}

		if (RocketChat.settings.get('Message_AllowDirectMessagesToYourself') === false && me.username === username) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'createDirectMessage',
			});
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'create-d')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'createDirectMessage',
			});
		}

		const to = RocketChat.models.Users.findOneByUsername(username);

		if (!to) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'createDirectMessage',
			});
		}

		if (!RocketChat.authz.hasPermission(to._id, 'view-d-room')) {
			throw new Meteor.Error('error-not-allowed', 'Target user not allowed to receive messages', {
				method: 'createDirectMessage',
			});
		}

		const rid = [me._id, to._id].sort().join('');

		const now = new Date();

		// Make sure we have a room
		RocketChat.models.Rooms.upsert({
			_id: rid,
		}, {
			$set: {
				usernames: [me.username, to.username],
			},
			$setOnInsert: {
				t: 'd',
				msgs: 0,
				ts: now,
				usersCount: 2,
			},
		});

		const myNotificationPref = RocketChat.getDefaultSubscriptionPref(me);

		// Make user I have a subcription to this room
		const upsertSubscription = {
			$set: {
				ls: now,
				open: true,
			},
			$setOnInsert: {
				fname: to.name,
				name: to.username,
				t: 'd',
				alert: false,
				unread: 0,
				userMentions: 0,
				groupMentions: 0,
				customFields: me.customFields,
				u: {
					_id: me._id,
					username: me.username,
				},
				ts: now,
				...myNotificationPref,
			},
		};

		if (to.active === false) {
			upsertSubscription.$set.archived = true;
		}

		RocketChat.models.Subscriptions.upsert({
			rid,
			$and: [{ 'u._id': me._id }], // work around to solve problems with upsert and dot
		}, upsertSubscription);

		const toNotificationPref = RocketChat.getDefaultSubscriptionPref(to);

		RocketChat.models.Subscriptions.upsert({
			rid,
			$and: [{ 'u._id': to._id }], // work around to solve problems with upsert and dot
		}, {
			$setOnInsert: {
				fname: me.name,
				name: me.username,
				t: 'd',
				open: false,
				alert: false,
				unread: 0,
				userMentions: 0,
				groupMentions: 0,
				customFields: to.customFields,
				u: {
					_id: to._id,
					username: to.username,
				},
				ts: now,
				...toNotificationPref,
			},
		});

		return {
			rid,
		};
	},
});

RocketChat.RateLimiter.limitMethod('createDirectMessage', 10, 60000, {
	userId(userId) {
		return !RocketChat.authz.hasPermission(userId, 'send-many-messages');
	},
});
