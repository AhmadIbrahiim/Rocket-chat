/* globals openRoom */
import { RoomTypeConfig, RoomTypeRouteConfig, RoomSettingsEnum, UiTextContext } from '../RoomTypeConfig';

export class PublicRoomRoute extends RoomTypeRouteConfig {
	constructor() {
		super({
			name: 'channel',
			path: '/channel/:name',
		});
	}

	action(params) {
		return openRoom('c', params.name);
	}
}

export class PublicRoomType extends RoomTypeConfig {
	constructor() {
		super({
			identifier: 'c',
			order: 30,
			icon: 'hashtag',
			label: 'Channels',
			route: new PublicRoomRoute(),
		});
	}

	findRoom(identifier) {
		const query = {
			t: 'c',
			name: identifier,
		};
		return ChatRoom.findOne(query);
	}

	roomName(roomData) {
		if (RocketChat.settings.get('UI_Allow_room_names_with_special_chars')) {
			return roomData.fname || roomData.name;
		}
		return roomData.name;
	}

	condition() {
		const groupByType = RocketChat.getUserPreference(Meteor.userId(), 'sidebarGroupByType');
		return groupByType && (RocketChat.authz.hasAtLeastOnePermission(['view-c-room', 'view-joined-room']) || RocketChat.settings.get('Accounts_AllowAnonymousRead') === true);
	}

	showJoinLink(roomId) {
		return !!ChatRoom.findOne({ _id: roomId, t: 'c' });
	}

	includeInRoomSearch() {
		return true;
	}

	isGroupChat() {
		return true;
	}

	canAddUser(room) {
		return RocketChat.authz.hasAtLeastOnePermission(['add-user-to-any-c-room', 'add-user-to-joined-room'], room._id);
	}

	enableMembersListProfile() {
		return true;
	}

	allowRoomSettingChange(room, setting) {
		switch (setting) {
			case RoomSettingsEnum.BROADCAST:
				return room.broadcast;
			case RoomSettingsEnum.READ_ONLY:
				return !room.broadcast;
			case RoomSettingsEnum.REACT_WHEN_READ_ONLY:
				return !room.broadcast && room.ro;
			case RoomSettingsEnum.SYSTEM_MESSAGES:
			default:
				return true;
		}
	}

	getUiText(context) {
		switch (context) {
			case UiTextContext.HIDE_WARNING:
				return 'Hide_Room_Warning';
			case UiTextContext.LEAVE_WARNING:
				return 'Leave_Room_Warning';
			default:
				return '';
		}
	}
}
