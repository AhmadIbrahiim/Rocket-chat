
// Kick is a named function that will replace /kick commands

const Kick = function(command, params, { rid }) {
	if (command !== 'kick' || !Match.test(params, String)) {
		return;
	}
	const username = params.trim().replace('@', '');
	if (username === '') {
		return;
	}
	const userId = Meteor.userId();
	const user = Meteor.users.findOne(userId);
	const kickedUser = RocketChat.models.Users.findOneByUsername(username);

	if (kickedUser == null) {
		return RocketChat.Notifications.notifyUser(userId, 'message', {
			_id: Random.id(),
			rid,
			ts: new Date,
			msg: TAPi18n.__('Username_doesnt_exist', {
				postProcess: 'sprintf',
				sprintf: [username],
			}, user.language),
		});
	}

	const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(rid, user._id, { fields: { _id: 1 } });
	if (!subscription) {
		return RocketChat.Notifications.notifyUser(userId, 'message', {
			_id: Random.id(),
			rid,
			ts: new Date,
			msg: TAPi18n.__('Username_is_not_in_this_room', {
				postProcess: 'sprintf',
				sprintf: [username],
			}, user.language),
		});
	}
	Meteor.call('removeUserFromRoom', { rid, username });
};

RocketChat.slashCommands.add('kick', Kick, {
	description: 'Remove_someone_from_room',
	params: '@username',
	permission: 'remove-user',
});
