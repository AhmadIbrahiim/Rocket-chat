import LivechatVisitors from '../../../server/models/LivechatVisitors';
import { findGuest, findRoom } from '../lib/livechat';

RocketChat.API.v1.addRoute('livechat/message', {
	post() {
		try {
			check(this.bodyParams, {
				_id: Match.Maybe(String),
				token: String,
				rid: String,
				msg: String,
				agent: Match.Maybe({
					agentId: String,
					username: String,
				}),
			});

			const { token, rid, agent, msg } = this.bodyParams;

			const guest = findGuest(token);
			if (!guest) {
				throw new Meteor.Error('invalid-token');
			}

			const room = findRoom(token, rid);
			if (!room) {
				throw new Meteor.Error('invalid-room');
			}

			const _id = this.bodyParams._id || Random.id();

			const sendMessage = {
				guest,
				message: {
					_id,
					rid,
					msg,
					token,
				},
				agent,
			};

			const result = RocketChat.Livechat.sendMessage(sendMessage);
			if (result) {
				const message = { _id: result._id, msg: result.msg, u: result.u, ts: result.ts };
				return RocketChat.API.v1.success({ message });
			}

			return RocketChat.API.v1.failure();
		} catch (e) {
			return RocketChat.API.v1.failure(e);
		}
	},
});

RocketChat.API.v1.addRoute('livechat/message/:_id', {
	put() {
		try {
			check(this.urlParams, {
				_id: String,
			});

			check(this.bodyParams, {
				token: String,
				rid: String,
				msg: String,
			});

			const { token, rid } = this.bodyParams;
			const { _id } = this.urlParams;

			const guest = findGuest(token);
			if (!guest) {
				throw new Meteor.Error('invalid-token');
			}

			const room = findRoom(token, rid);
			if (!room) {
				throw new Meteor.Error('invalid-room');
			}

			const msg = RocketChat.models.Messages.findOneById(_id);
			if (!msg) {
				throw new Meteor.Error('invalid-message');
			}

			const message = { _id: msg._id, msg: this.bodyParams.msg };

			const result = RocketChat.Livechat.updateMessage({ guest, message });
			if (result) {
				const data = RocketChat.models.Messages.findOneById(_id);
				return RocketChat.API.v1.success({
					message: { _id: data._id, msg: data.msg, u: data.u, ts: data.ts },
				});
			}

			return RocketChat.API.v1.failure();
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	},
	delete() {
		try {
			check(this.urlParams, {
				_id: String,
			});

			check(this.bodyParams, {
				token: String,
				rid: String,
			});

			const { token, rid } = this.bodyParams;
			const { _id } = this.urlParams;

			const guest = findGuest(token);
			if (!guest) {
				throw new Meteor.Error('invalid-token');
			}

			const room = findRoom(token, rid);
			if (!room) {
				throw new Meteor.Error('invalid-room');
			}

			const message = RocketChat.models.Messages.findOneById(_id);
			if (!message) {
				throw new Meteor.Error('invalid-message');
			}

			const result = RocketChat.Livechat.deleteMessage({ guest, message });
			if (result) {
				return RocketChat.API.v1.success({
					message: {
						_id,
						ts: new Date().toISOString(),
					},
				});
			}

			return RocketChat.API.v1.failure();
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	},
});

RocketChat.API.v1.addRoute('livechat/messages.history/:rid', {
	get() {
		try {
			check(this.urlParams, {
				rid: String,
			});

			const { rid } = this.urlParams;
			const { token } = this.queryParams;

			if (!token) {
				throw new Meteor.Error('error-token-param-not-provided', 'The required "token" query param is missing.');
			}

			const guest = findGuest(token);
			if (!guest) {
				throw new Meteor.Error('invalid-token');
			}

			const room = findRoom(token, rid);
			if (!room) {
				throw new Meteor.Error('invalid-room');
			}

			let ls = undefined;
			if (this.queryParams.ls) {
				ls = new Date(this.queryParams.ls);
			}

			let end = undefined;
			if (this.queryParams.end) {
				end = new Date(this.queryParams.end);
			}

			let limit = 20;
			if (this.queryParams.limit) {
				limit = parseInt(this.queryParams.limit);
			}

			const messages = RocketChat.loadMessageHistory({ userId: guest._id, rid, end, limit, ls });
			return RocketChat.API.v1.success(messages);
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	},
});

RocketChat.API.v1.addRoute('livechat/messages', { authRequired: true }, {
	post() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		if (!this.bodyParams.visitor) {
			return RocketChat.API.v1.failure('Body param "visitor" is required');
		}
		if (!this.bodyParams.visitor.token) {
			return RocketChat.API.v1.failure('Body param "visitor.token" is required');
		}
		if (!this.bodyParams.messages) {
			return RocketChat.API.v1.failure('Body param "messages" is required');
		}
		if (!(this.bodyParams.messages instanceof Array)) {
			return RocketChat.API.v1.failure('Body param "messages" is not an array');
		}
		if (this.bodyParams.messages.length === 0) {
			return RocketChat.API.v1.failure('Body param "messages" is empty');
		}

		const visitorToken = this.bodyParams.visitor.token;

		let visitor = LivechatVisitors.getVisitorByToken(visitorToken);
		let rid;
		if (visitor) {
			const rooms = RocketChat.models.Rooms.findOpenByVisitorToken(visitorToken).fetch();
			if (rooms && rooms.length > 0) {
				rid = rooms[0]._id;
			} else {
				rid = Random.id();
			}
		} else {
			rid = Random.id();
			const visitorId = RocketChat.Livechat.registerGuest(this.bodyParams.visitor);
			visitor = LivechatVisitors.findOneById(visitorId);
		}

		const sentMessages = this.bodyParams.messages.map((message) => {
			const sendMessage = {
				guest: visitor,
				message: {
					_id: Random.id(),
					rid,
					token: visitorToken,
					msg: message.msg,
				},
			};
			const sentMessage = RocketChat.Livechat.sendMessage(sendMessage);
			return {
				username: sentMessage.u.username,
				msg: sentMessage.msg,
				ts: sentMessage.ts,
			};
		});

		return RocketChat.API.v1.success({
			messages: sentMessages,
		});
	},
});
