/* global processWebhookMessage */

RocketChat.API.v1.addRoute('chat.delete', { authRequired: true }, {
	post() {
		check(this.bodyParams, Match.ObjectIncluding({
			msgId: String,
			roomId: String,
			asUser: Match.Maybe(Boolean),
		}));

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.msgId, { fields: { u: 1, rid: 1 } });

		if (!msg) {
			return RocketChat.API.v1.failure(`No message found with the id of "${ this.bodyParams.msgId }".`);
		}

		if (this.bodyParams.roomId !== msg.rid) {
			return RocketChat.API.v1.failure('The room id provided does not match where the message is from.');
		}

		if (this.bodyParams.asUser && msg.u._id !== this.userId && !RocketChat.authz.hasPermission(Meteor.userId(), 'force-delete-message', msg.rid)) {
			return RocketChat.API.v1.failure('Unauthorized. You must have the permission "force-delete-message" to delete other\'s message as them.');
		}

		Meteor.runAsUser(this.bodyParams.asUser ? msg.u._id : this.userId, () => {
			Meteor.call('deleteMessage', { _id: msg._id });
		});

		return RocketChat.API.v1.success({
			_id: msg._id,
			ts: Date.now(),
			message: msg,
		});
	},
});

RocketChat.API.v1.addRoute('chat.syncMessages', { authRequired: true }, {
	get() {
		const { roomId, lastUpdate } = this.queryParams;

		if (!roomId) {
			throw new Meteor.Error('error-roomId-param-not-provided', 'The required "roomId" query param is missing.');
		}

		if (!lastUpdate) {
			throw new Meteor.Error('error-lastUpdate-param-not-provided', 'The required "lastUpdate" query param is missing.');
		} else if (isNaN(Date.parse(lastUpdate))) {
			throw new Meteor.Error('error-roomId-param-invalid', 'The "lastUpdate" query parameter must be a valid date.');
		}

		let result;
		Meteor.runAsUser(this.userId, () => {
			result = Meteor.call('messages/get', roomId, { lastUpdate: new Date(lastUpdate) });
		});

		if (!result) {
			return RocketChat.API.v1.failure();
		}

		return RocketChat.API.v1.success({
			result,
		});
	},
});

RocketChat.API.v1.addRoute('chat.getMessage', { authRequired: true }, {
	get() {
		if (!this.queryParams.msgId) {
			return RocketChat.API.v1.failure('The "msgId" query parameter must be provided.');
		}

		let msg;
		Meteor.runAsUser(this.userId, () => {
			msg = Meteor.call('getSingleMessage', this.queryParams.msgId);
		});

		if (!msg) {
			return RocketChat.API.v1.failure();
		}

		return RocketChat.API.v1.success({
			message: msg,
		});
	},
});

RocketChat.API.v1.addRoute('chat.pinMessage', { authRequired: true }, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is missing.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		let pinnedMessage;
		Meteor.runAsUser(this.userId, () => pinnedMessage = Meteor.call('pinMessage', msg));

		return RocketChat.API.v1.success({
			message: pinnedMessage,
		});
	},
});

RocketChat.API.v1.addRoute('chat.postMessage', { authRequired: true }, {
	post() {
		const messageReturn = processWebhookMessage(this.bodyParams, this.user, undefined, true)[0];

		if (!messageReturn) {
			return RocketChat.API.v1.failure('unknown-error');
		}

		return RocketChat.API.v1.success({
			ts: Date.now(),
			channel: messageReturn.channel,
			message: messageReturn.message,
		});
	},
});

RocketChat.API.v1.addRoute('chat.search', { authRequired: true }, {
	get() {
		const { roomId, searchText } = this.queryParams;
		const { count } = this.getPaginationItems();

		if (!roomId) {
			throw new Meteor.Error('error-roomId-param-not-provided', 'The required "roomId" query param is missing.');
		}

		if (!searchText) {
			throw new Meteor.Error('error-searchText-param-not-provided', 'The required "searchText" query param is missing.');
		}

		let result;
		Meteor.runAsUser(this.userId, () => result = Meteor.call('messageSearch', searchText, roomId, count).message.docs);

		return RocketChat.API.v1.success({
			messages: result,
		});
	},
});

// The difference between `chat.postMessage` and `chat.sendMessage` is that `chat.sendMessage` allows
// for passing a value for `_id` and the other one doesn't. Also, `chat.sendMessage` only sends it to
// one channel whereas the other one allows for sending to more than one channel at a time.
RocketChat.API.v1.addRoute('chat.sendMessage', { authRequired: true }, {
	post() {
		if (!this.bodyParams.message) {
			throw new Meteor.Error('error-invalid-params', 'The "message" parameter must be provided.');
		}

		let message;
		Meteor.runAsUser(this.userId, () => message = Meteor.call('sendMessage', this.bodyParams.message));

		return RocketChat.API.v1.success({
			message,
		});
	},
});

RocketChat.API.v1.addRoute('chat.starMessage', { authRequired: true }, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is required.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('starMessage', {
			_id: msg._id,
			rid: msg.rid,
			starred: true,
		}));

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('chat.unPinMessage', { authRequired: true }, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is required.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('unpinMessage', msg));

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('chat.unStarMessage', { authRequired: true }, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is required.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('starMessage', {
			_id: msg._id,
			rid: msg.rid,
			starred: false,
		}));

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('chat.update', { authRequired: true }, {
	post() {
		check(this.bodyParams, Match.ObjectIncluding({
			roomId: String,
			msgId: String,
			text: String, // Using text to be consistant with chat.postMessage
		}));

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.msgId);

		// Ensure the message exists
		if (!msg) {
			return RocketChat.API.v1.failure(`No message found with the id of "${ this.bodyParams.msgId }".`);
		}

		if (this.bodyParams.roomId !== msg.rid) {
			return RocketChat.API.v1.failure('The room id provided does not match where the message is from.');
		}

		// Permission checks are already done in the updateMessage method, so no need to duplicate them
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('updateMessage', { _id: msg._id, msg: this.bodyParams.text, rid: msg.rid });
		});

		return RocketChat.API.v1.success({
			message: RocketChat.models.Messages.findOneById(msg._id),
		});
	},
});

RocketChat.API.v1.addRoute('chat.react', { authRequired: true }, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is missing.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		const emoji = this.bodyParams.emoji || this.bodyParams.reaction;

		if (!emoji) {
			throw new Meteor.Error('error-emoji-param-not-provided', 'The required "emoji" param is missing.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('setReaction', emoji, msg._id, this.bodyParams.shouldReact));

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('chat.getMessageReadReceipts', { authRequired: true }, {
	get() {
		const { messageId } = this.queryParams;
		if (!messageId) {
			return RocketChat.API.v1.failure({
				error: 'The required \'messageId\' param is missing.',
			});
		}

		try {
			const messageReadReceipts = Meteor.runAsUser(this.userId, () => Meteor.call('getReadReceipts', { messageId }));
			return RocketChat.API.v1.success({
				receipts: messageReadReceipts,
			});
		} catch (error) {
			return RocketChat.API.v1.failure({
				error: error.message,
			});
		}
	},
});

RocketChat.API.v1.addRoute('chat.reportMessage', { authRequired: true }, {
	post() {
		const { messageId, description } = this.bodyParams;
		if (!messageId) {
			return RocketChat.API.v1.failure('The required "messageId" param is missing.');
		}

		if (!description) {
			return RocketChat.API.v1.failure('The required "description" param is missing.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('reportMessage', messageId, description));

		return RocketChat.API.v1.success();
	},
});

RocketChat.API.v1.addRoute('chat.ignoreUser', { authRequired: true }, {
	get() {
		const { rid, userId } = this.queryParams;
		let { ignore = true } = this.queryParams;

		ignore = typeof ignore === 'string' ? /true|1/.test(ignore) : ignore;

		if (!rid || !rid.trim()) {
			throw new Meteor.Error('error-room-id-param-not-provided', 'The required "rid" param is missing.');
		}

		if (!userId || !userId.trim()) {
			throw new Meteor.Error('error-user-id-param-not-provided', 'The required "userId" param is missing.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('ignoreUser', { rid, userId, ignore }));

		return RocketChat.API.v1.success();
	},
});
