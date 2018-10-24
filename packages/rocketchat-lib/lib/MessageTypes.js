RocketChat.MessageTypes = new class {
	constructor() {
		this.types = {};
	}

	registerType(options) {
		return this.types[options.id] = options;
	}

	getType(message) {
		return this.types[message && message.t];
	}

	isSystemMessage(message) {
		const type = this.types[message && message.t];
		return type && type.system;
	}

};

Meteor.startup(function() {
	RocketChat.MessageTypes.registerType({
		id: 'r',
		system: true,
		message: 'Room_name_changed',
		data(message) {
			return {
				room_name: message.msg,
				user_by: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'au',
		system: true,
		message: 'User_added_by',
		data(message) {
			return {
				user_added: message.msg,
				user_by: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'ru',
		system: true,
		message: 'User_removed_by',
		data(message) {
			return {
				user_removed: message.msg,
				user_by: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'ul',
		system: true,
		message: 'User_left',
		data(message) {
			return {
				user_left: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'uj',
		system: true,
		message: 'User_joined_channel',
		data(message) {
			return {
				user: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'wm',
		system: true,
		message: 'Welcome',
		data(message) {
			return {
				user: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'rm',
		system: true,
		message: 'Message_removed',
		data(message) {
			return {
				user: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'rtc',
		render(message) {
			return RocketChat.callbacks.run('renderRtcMessage', message);
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'user-muted',
		system: true,
		message: 'User_muted_by',
		data(message) {
			return {
				user_muted: message.msg,
				user_by: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'user-unmuted',
		system: true,
		message: 'User_unmuted_by',
		data(message) {
			return {
				user_unmuted: message.msg,
				user_by: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'subscription-role-added',
		system: true,
		message: '__username__was_set__role__by__user_by_',
		data(message) {
			return {
				username: message.msg,
				role: message.role,
				user_by: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'subscription-role-removed',
		system: true,
		message: '__username__is_no_longer__role__defined_by__user_by_',
		data(message) {
			return {
				username: message.msg,
				role: message.role,
				user_by: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'room-archived',
		system: true,
		message: 'This_room_has_been_archived_by__username_',
		data(message) {
			return {
				username: message.u.username,
			};
		},
	});
	RocketChat.MessageTypes.registerType({
		id: 'room-unarchived',
		system: true,
		message: 'This_room_has_been_unarchived_by__username_',
		data(message) {
			return {
				username: message.u.username,
			};
		},
	});
});
