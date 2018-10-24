/* globals readMessage UserRoles RoomRoles*/
import _ from 'underscore';

export const upsertMessage = ({ msg, subscription }) => {
	const userId = msg.u && msg.u._id;

	if (subscription && subscription.ignored && subscription.ignored.indexOf(userId) > -1) {
		msg.ignored = true;
	}
	const roles = [
		(userId && UserRoles.findOne(userId, { fields: { roles: 1 } })) || {},
		(userId && RoomRoles.findOne({ rid: msg.rid, 'u._id': userId })) || {},
	].map((e) => e.roles);
	msg.roles = _.union.apply(_.union, roles);
	if (msg.t === 'e2e' && !msg.file) {
		msg.e2e = 'pending';
	}

	return ChatMessage.upsert({ _id: msg._id }, msg);
};

export const RoomHistoryManager = new class {
	constructor() {
		this.defaultLimit = 50;
		this.histories = {};
	}
	getRoom(rid) {
		if ((this.histories[rid] == null)) {
			this.histories[rid] = {
				hasMore: new ReactiveVar(true),
				hasMoreNext: new ReactiveVar(false),
				isLoading: new ReactiveVar(false),
				unreadNotLoaded: new ReactiveVar(0),
				firstUnread: new ReactiveVar,
				loaded: undefined,
			};
		}

		return this.histories[rid];
	}

	getMore(rid, limit) {
		let ts;
		if (limit == null) { limit = this.defaultLimit; }
		const room = this.getRoom(rid);
		if (room.hasMore.curValue !== true) {
			return;
		}

		room.isLoading.set(true);

		// ScrollListener.setLoader true
		const lastMessage = ChatMessage.findOne({ rid }, { sort: { ts: 1 } });
		// lastMessage ?= ChatMessage.findOne({rid: rid}, {sort: {ts: 1}})

		if (lastMessage != null) {
			({ ts } = lastMessage);
		} else {
			ts = undefined;
		}

		let ls = undefined;
		let typeName = undefined;

		const subscription = ChatSubscription.findOne({ rid });
		if (subscription != null) {
			({ ls } = subscription);
			typeName = subscription.t + subscription.name;
		} else {
			const curRoomDoc = ChatRoom.findOne({ _id: rid });
			typeName = (curRoomDoc != null ? curRoomDoc.t : undefined) + (curRoomDoc != null ? curRoomDoc.name : undefined);
		}

		Meteor.call('loadHistory', rid, ts, limit, ls, function(err, result) {
			if (err) {
				return;
			}

			let previousHeight;
			const { messages = [] } = result;
			room.unreadNotLoaded.set(result.unreadNotLoaded);
			room.firstUnread.set(result.firstUnread);

			const wrapper = $('.messages-box .wrapper').get(0);
			if (wrapper != null) {
				previousHeight = wrapper.scrollHeight;
			}

			messages.forEach((msg) => msg.t !== 'command' && upsertMessage({ msg, subscription }));

			if (wrapper) {
				const heightDiff = wrapper.scrollHeight - previousHeight;
				wrapper.scrollTop += heightDiff;
			}

			Meteor.defer(() => {
				readMessage.refreshUnreadMark(rid, true);
				return RoomManager.updateMentionsMarksOfRoom(typeName);
			});

			room.isLoading.set(false);
			if (room.loaded == null) { room.loaded = 0; }
			room.loaded += messages.length;
			if (messages.length < limit) {
				return room.hasMore.set(false);
			}
		});
	}

	getMoreNext(rid, limit) {
		if (limit == null) { limit = this.defaultLimit; }
		const room = this.getRoom(rid);
		if (room.hasMoreNext.curValue !== true) {
			return;
		}

		const instance = Blaze.getView($('.messages-box .wrapper')[0]).templateInstance();
		instance.atBottom = false;

		room.isLoading.set(true);

		const lastMessage = ChatMessage.findOne({ rid }, { sort: { ts: -1 } });

		let typeName = undefined;

		const subscription = ChatSubscription.findOne({ rid });
		if (subscription != null) {
			// const { ls } = subscription;
			typeName = subscription.t + subscription.name;
		} else {
			const curRoomDoc = ChatRoom.findOne({ _id: rid });
			typeName = (curRoomDoc != null ? curRoomDoc.t : undefined) + (curRoomDoc != null ? curRoomDoc.name : undefined);
		}

		const { ts } = lastMessage;

		if (ts) {
			return Meteor.call('loadNextMessages', rid, ts, limit, function(err, result) {
				for (const msg of Array.from((result != null ? result.messages : undefined) || [])) {
					if (msg.t !== 'command') {
						upsertMessage({ msg, subscription });
					}
				}

				Meteor.defer(() => RoomManager.updateMentionsMarksOfRoom(typeName));

				room.isLoading.set(false);
				if (room.loaded == null) { room.loaded = 0; }

				room.loaded += result.messages.length;
				if (result.messages.length < limit) {
					room.hasMoreNext.set(false);
				}
			});
		}
	}

	getSurroundingMessages(message, limit) {
		if (limit == null) { limit = this.defaultLimit; }
		if (!(message != null ? message.rid : undefined)) {
			return;
		}

		const instance = Blaze.getView($('.messages-box .wrapper')[0]).templateInstance();

		if (ChatMessage.findOne(message._id)) {
			const wrapper = $('.messages-box .wrapper');
			const msgElement = $(`#${ message._id }`, wrapper);
			if (msgElement.length === 0) {
				return;
			}
			const pos = (wrapper.scrollTop() + msgElement.offset().top) - (wrapper.height() / 2);
			wrapper.animate({
				scrollTop: pos,
			}, 500);
			msgElement.addClass('highlight');

			setTimeout(function() {
				const messages = wrapper[0];
				return instance.atBottom = messages.scrollTop >= (messages.scrollHeight - messages.clientHeight);
			});

			return setTimeout(() => msgElement.removeClass('highlight'), 500);
		} else {
			const room = this.getRoom(message.rid);
			room.isLoading.set(true);
			ChatMessage.remove({ rid: message.rid });

			let typeName = undefined;

			const subscription = ChatSubscription.findOne({ rid: message.rid });
			if (subscription) {
				// const { ls } = subscription;
				typeName = subscription.t + subscription.name;
			} else {
				const curRoomDoc = ChatRoom.findOne({ _id: message.rid });
				typeName = (curRoomDoc != null ? curRoomDoc.t : undefined) + (curRoomDoc != null ? curRoomDoc.name : undefined);
			}

			return Meteor.call('loadSurroundingMessages', message, limit, function(err, result) {
				if (!result || !result.messages) {
					return;
				}
				for (const msg of Array.from(result.messages)) {
					if (msg.t !== 'command') {
						upsertMessage({ msg, subscription });
					}
				}

				Meteor.defer(function() {
					readMessage.refreshUnreadMark(message.rid, true);
					RoomManager.updateMentionsMarksOfRoom(typeName);
					const wrapper = $('.messages-box .wrapper');
					const msgElement = $(`#${ message._id }`, wrapper);
					const pos = (wrapper.scrollTop() + msgElement.offset().top) - (wrapper.height() / 2);
					wrapper.animate({
						scrollTop: pos,
					}, 500);

					msgElement.addClass('highlight');

					setTimeout(function() {
						room.isLoading.set(false);
						const messages = wrapper[0];
						instance.atBottom = !result.moreAfter && (messages.scrollTop >= (messages.scrollHeight - messages.clientHeight));
						return 500;
					});

					return setTimeout(() => msgElement.removeClass('highlight'), 500);
				});
				if (room.loaded == null) { room.loaded = 0; }
				room.loaded += result.messages.length;
				room.hasMore.set(result.moreBefore);
				return room.hasMoreNext.set(result.moreAfter);
			});
		}
	}

	hasMore(rid) {
		const room = this.getRoom(rid);
		return room.hasMore.get();
	}

	hasMoreNext(rid) {
		const room = this.getRoom(rid);
		return room.hasMoreNext.get();
	}


	getMoreIfIsEmpty(rid) {
		const room = this.getRoom(rid);

		if (room.loaded === undefined) {
			return this.getMore(rid);
		}
	}


	isLoading(rid) {
		const room = this.getRoom(rid);
		return room.isLoading.get();
	}

	clear(rid) {
		ChatMessage.remove({ rid });
		if (this.histories[rid] != null) {
			this.histories[rid].hasMore.set(true);
			this.histories[rid].isLoading.set(false);
			return this.histories[rid].loaded = undefined;
		}
	}
};
this.RoomHistoryManager = RoomHistoryManager;
