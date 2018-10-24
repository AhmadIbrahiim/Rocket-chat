import { findGuest, findRoom, getRoom, settings } from '../lib/livechat';

RocketChat.API.v1.addRoute('livechat/room', {
	get() {
		try {
			check(this.queryParams, {
				token: String,
				rid: Match.Maybe(String),
			});

			const { token } = this.queryParams;
			const guest = findGuest(token);
			if (!guest) {
				throw new Meteor.Error('invalid-token');
			}

			const rid = this.queryParams.rid || Random.id();
			const room = getRoom(guest, rid);

			return RocketChat.API.v1.success(room);
		} catch (e) {
			return RocketChat.API.v1.failure(e);
		}
	},
});

RocketChat.API.v1.addRoute('livechat/room.close', {
	post() {
		try {
			check(this.bodyParams, {
				rid: String,
				token: String,
			});

			const { rid } = this.bodyParams;
			const { token } = this.bodyParams;

			const visitor = findGuest(token);
			if (!visitor) {
				throw new Meteor.Error('invalid-token');
			}

			const room = findRoom(token, rid);
			if (!room) {
				throw new Meteor.Error('invalid-room');
			}

			if (!room.open) {
				throw new Meteor.Error('room-closed');
			}

			const language = RocketChat.settings.get('language') || 'en';
			const comment = TAPi18n.__('Closed_by_visitor', { lng: language });

			if (!RocketChat.Livechat.closeRoom({ visitor, room, comment })) {
				return RocketChat.API.v1.failure();
			}

			return RocketChat.API.v1.success({ rid, comment });
		} catch (e) {
			return RocketChat.API.v1.failure(e);
		}
	},
});

RocketChat.API.v1.addRoute('livechat/room.transfer', {
	post() {
		try {
			check(this.bodyParams, {
				rid: String,
				token: String,
				department: String,
			});

			const { rid } = this.bodyParams;
			const { token, department } = this.bodyParams;

			const guest = findGuest(token);
			if (!guest) {
				throw new Meteor.Error('invalid-token');
			}

			let room = findRoom(token, rid);
			if (!room) {
				throw new Meteor.Error('invalid-room');
			}

			// update visited page history to not expire
			RocketChat.models.Messages.keepHistoryForToken(token);

			if (!RocketChat.Livechat.transfer(room, guest, { roomId: rid, departmentId: department })) {
				return RocketChat.API.v1.failure();
			}

			room = findRoom(token, rid);
			return RocketChat.API.v1.success({ room });
		} catch (e) {
			return RocketChat.API.v1.failure(e);
		}
	},
});

RocketChat.API.v1.addRoute('livechat/room.survey', {
	post() {
		try {
			check(this.bodyParams, {
				rid: String,
				token: String,
				data: [Match.ObjectIncluding({
					name: String,
					value: String,
				})],
			});

			const { rid } = this.bodyParams;
			const { token, data } = this.bodyParams;

			const visitor = findGuest(token);
			if (!visitor) {
				throw new Meteor.Error('invalid-token');
			}

			const room = findRoom(token, rid);
			if (!room) {
				throw new Meteor.Error('invalid-room');
			}

			const config = settings();
			if (!config.survey || !config.survey.items || !config.survey.values) {
				throw new Meteor.Error('invalid-livechat-config');
			}

			const updateData = {};
			for (const item of data) {
				if ((config.survey.items.includes(item.name) && config.survey.values.includes(item.value)) || item.name === 'additionalFeedback') {
					updateData[item.name] = item.value;
				}
			}

			if (Object.keys(updateData).length === 0) {
				throw new Meteor.Error('invalid-data');
			}

			if (!RocketChat.models.Rooms.updateSurveyFeedbackById(room._id, updateData)) {
				return RocketChat.API.v1.failure();
			}

			return RocketChat.API.v1.success({ rid, data: updateData });
		} catch (e) {
			return RocketChat.API.v1.failure(e);
		}
	},
});
