
/*
* Unmute is a named function that will replace /unmute commands
*/

RocketChat.slashCommands.add('unmute', function Unmute(command, params, item) {

	if (command !== 'unmute' || !Match.test(params, String)) {
		return;
	}
	const username = params.trim().replace('@', '');
	if (username === '') {
		return;
	}
	const user = Meteor.users.findOne(Meteor.userId());
	const unmutedUser = RocketChat.models.Users.findOneByUsername(username);
	if (unmutedUser == null) {
		return RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date,
			msg: TAPi18n.__('Username_doesnt_exist', {
				postProcess: 'sprintf',
				sprintf: [username],
			}, user.language),
		});
	}

	const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(item.rid, unmutedUser._id, { fields: { _id: 1 } });
	if (!subscription) {
		return RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date,
			msg: TAPi18n.__('Username_is_not_in_this_room', {
				postProcess: 'sprintf',
				sprintf: [username],
			}, user.language),
		});
	}
	Meteor.call('unmuteUserInRoom', {
		rid: item.rid,
		username,
	});
}, {
	description: 'Unmute_someone_in_room',
	params: '@username',
});
