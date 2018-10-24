/*
 * Invite is a named function that will replace /invite commands
 * @param {Object} message - The message object
 */

function inviteAll(type) {
	return function inviteAll(command, params, item) {

		if (!/invite\-all-(to|from)/.test(command) || !Match.test(params, String)) {
			return;
		}

		const regexp = /#?([\d-_\w]+)/g;
		const [, channel] = regexp.exec(params.trim());

		if (!channel) {
			return;
		}
		const userId = Meteor.userId();
		const currentUser = Meteor.users.findOne(userId);
		const baseChannel = type === 'to' ? RocketChat.models.Rooms.findOneById(item.rid) : RocketChat.models.Rooms.findOneByName(channel);
		const targetChannel = type === 'from' ? RocketChat.models.Rooms.findOneById(item.rid) : RocketChat.models.Rooms.findOneByName(channel);

		if (!baseChannel) {
			return RocketChat.Notifications.notifyUser(userId, 'message', {
				_id: Random.id(),
				rid: item.rid,
				ts: new Date(),
				msg: TAPi18n.__('Channel_doesnt_exist', {
					postProcess: 'sprintf',
					sprintf: [channel],
				}, currentUser.language),
			});
		}
		const cursor = RocketChat.models.Subscriptions.findByRoomIdWhenUsernameExists(baseChannel._id, { fields: { 'u.username': 1 } });

		try {
			if (cursor.count() > RocketChat.settings.get('API_User_Limit')) {
				throw new Meteor.Error('error-user-limit-exceeded', 'User Limit Exceeded', {
					method: 'addAllToRoom',
				});
			}
			const users = cursor.fetch().map((s) => s.u.username);

			if (!targetChannel && ['c', 'p'].indexOf(baseChannel.t) > -1) {
				Meteor.call(baseChannel.t === 'c' ? 'createChannel' : 'createPrivateGroup', channel, users);
				RocketChat.Notifications.notifyUser(userId, 'message', {
					_id: Random.id(),
					rid: item.rid,
					ts: new Date(),
					msg: TAPi18n.__('Channel_created', {
						postProcess: 'sprintf',
						sprintf: [channel],
					}, currentUser.language),
				});
			} else {
				Meteor.call('addUsersToRoom', {
					rid: targetChannel._id,
					users,
				});
			}
			return RocketChat.Notifications.notifyUser(userId, 'message', {
				_id: Random.id(),
				rid: item.rid,
				ts: new Date(),
				msg: TAPi18n.__('Users_added', null, currentUser.language),
			});
		} catch (e) {
			const msg = e.error === 'cant-invite-for-direct-room' ? 'Cannot_invite_users_to_direct_rooms' : e.error;
			RocketChat.Notifications.notifyUser(userId, 'message', {
				_id: Random.id(),
				rid: item.rid,
				ts: new Date(),
				msg: TAPi18n.__(msg, null, currentUser.language),
			});
		}
	};
}

RocketChat.slashCommands.add('invite-all-to', inviteAll('to'), {
	description: 'Invite_user_to_join_channel_all_to',
	params: '#room',
});
RocketChat.slashCommands.add('invite-all-from', inviteAll('from'), {
	description: 'Invite_user_to_join_channel_all_from',
	params: '#room',
});
module.exports = inviteAll;
