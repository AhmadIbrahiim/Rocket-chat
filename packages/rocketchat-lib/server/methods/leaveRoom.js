Meteor.methods({
	leaveRoom(rid) {

		check(rid, String);

		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', { method: 'leaveRoom' });
		}

		this.unblock();

		const room = RocketChat.models.Rooms.findOneById(rid);
		const user = Meteor.user();

		if (room.t === 'd' || (room.t === 'c' && !RocketChat.authz.hasPermission(user._id, 'leave-c')) || (room.t === 'p' && !RocketChat.authz.hasPermission(user._id, 'leave-p'))) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'leaveRoom' });
		}

		const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(rid, user._id, { fields: { _id: 1 } });
		if (!subscription) {
			throw new Meteor.Error('error-user-not-in-room', 'You are not in this room', { method: 'leaveRoom' });
		}

		// If user is room owner, check if there are other owners. If there isn't anyone else, warn user to set a new owner.
		if (RocketChat.authz.hasRole(user._id, 'owner', room._id)) {
			const numOwners = RocketChat.authz.getUsersInRole('owner', room._id).count();
			if (numOwners === 1) {
				throw new Meteor.Error('error-you-are-last-owner', 'You are the last owner. Please set new owner before leaving the room.', { method: 'leaveRoom' });
			}
		}

		return RocketChat.removeUserFromRoom(rid, user);
	},
});
