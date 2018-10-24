/* globals openRoom, LivechatInquiry */
import { RoomSettingsEnum, RoomTypeConfig, RoomTypeRouteConfig, UiTextContext } from 'meteor/rocketchat:lib';

class LivechatRoomRoute extends RoomTypeRouteConfig {
	constructor() {
		super({
			name: 'live',
			path: '/live/:id',
		});
	}

	action(params) {
		openRoom('l', params.id);
	}

	link(sub) {
		return {
			id: sub.rid,
		};
	}
}

export default class LivechatRoomType extends RoomTypeConfig {
	constructor() {
		super({
			identifier: 'l',
			order: 5,
			icon: 'livechat',
			label: 'Livechat',
			route: new LivechatRoomRoute(),
		});

		this.notSubscribedTpl = {
			template: 'livechatNotSubscribed',
		};
	}

	findRoom(identifier) {
		return ChatRoom.findOne({ _id: identifier });
	}

	roomName(roomData) {
		return roomData.name || roomData.fname || roomData.label;
	}

	condition() {
		return RocketChat.settings.get('Livechat_enabled') && RocketChat.authz.hasAllPermission('view-l-room');
	}

	canSendMessage(roomId) {
		const room = ChatRoom.findOne({ _id: roomId }, { fields: { open: 1 } });
		return room && room.open === true;
	}

	getUserStatus(roomId) {
		const room = Session.get(`roomData${ roomId }`);
		if (room) {
			return room.v && room.v.status;
		}

		const inquiry = LivechatInquiry.findOne({ rid: roomId });
		return inquiry && inquiry.v && inquiry.v.status;
	}

	allowRoomSettingChange(room, setting) {
		switch (setting) {
			case RoomSettingsEnum.JOIN_CODE:
				return false;
			default:
				return true;
		}
	}

	getUiText(context) {
		switch (context) {
			case UiTextContext.HIDE_WARNING:
				return 'Hide_Livechat_Warning';
			case UiTextContext.LEAVE_WARNING:
				return 'Hide_Livechat_Warning';
			default:
				return '';
		}
	}
}
