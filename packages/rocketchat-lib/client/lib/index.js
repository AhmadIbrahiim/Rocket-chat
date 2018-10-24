/*
	What is this file? Great question! To make Rocket.Chat more "modular"
	and to make the "rocketchat:lib" package more of a core package
	with the libraries, this index file contains the exported members
	for the *client* pieces of code which does include the shared
	library files.
*/

import { RocketChatTabBar } from './RocketChatTabBar';
import { RocketChatAnnouncement } from './RocketChatAnnouncement';
import { RoomSettingsEnum, RoomTypeConfig, RoomTypeRouteConfig, UiTextContext } from '../../lib/RoomTypeConfig';
import { hide, leave, erase } from './ChannelActions';
import { call } from './callMethod';
import { LoginPresence } from './LoginPresence';
import * as DateFormat from './formatDate';

export {
	call,
	erase,
	hide,
	leave,
	RocketChatTabBar,
	RoomSettingsEnum,
	RoomTypeConfig,
	RoomTypeRouteConfig,
	UiTextContext,
	RocketChatAnnouncement,
	LoginPresence,
	DateFormat,
};
