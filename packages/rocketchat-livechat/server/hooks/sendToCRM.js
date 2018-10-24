const msgNavType = 'livechat_navigation_history';

const sendMessageType = (msgType) => {
	const sendNavHistory = RocketChat.settings.get('Livechat_Visitor_navigation_as_a_message') && RocketChat.settings.get('Send_visitor_navigation_history_livechat_webhook_request');

	return sendNavHistory && msgType === msgNavType;
};

function sendToCRM(type, room, includeMessages = true) {
	const postData = RocketChat.Livechat.getLivechatRoomGuestInfo(room);

	postData.type = type;

	postData.messages = [];

	let messages;
	if (typeof includeMessages === 'boolean' && includeMessages) {
		messages = RocketChat.models.Messages.findVisibleByRoomId(room._id, { sort: { ts: 1 } });
	} else if (includeMessages instanceof Array) {
		messages = includeMessages;
	}

	if (messages) {
		messages.forEach((message) => {
			if (message.t && !sendMessageType(message.t)) {
				return;
			}
			const msg = {
				_id: message._id,
				username: message.u.username,
				msg: message.msg,
				ts: message.ts,
				editedAt: message.editedAt,
			};

			if (message.u.username !== postData.visitor.username) {
				msg.agentId = message.u._id;
			}

			if (message.t === msgNavType) {
				msg.navigation = message.navigation;
			}

			postData.messages.push(msg);
		});
	}

	const response = RocketChat.Livechat.sendRequest(postData);

	if (response && response.data && response.data.data) {
		RocketChat.models.Rooms.saveCRMDataByRoomId(room._id, response.data.data);
	}

	return room;
}

RocketChat.callbacks.add('livechat.closeRoom', (room) => {
	if (!RocketChat.settings.get('Livechat_webhook_on_close')) {
		return room;
	}

	return sendToCRM('LivechatSession', room);
}, RocketChat.callbacks.priority.MEDIUM, 'livechat-send-crm-close-room');

RocketChat.callbacks.add('livechat.saveInfo', (room) => {
	// Do not send to CRM if the chat is still open
	if (room.open) {
		return room;
	}

	return sendToCRM('LivechatEdit', room);
}, RocketChat.callbacks.priority.MEDIUM, 'livechat-send-crm-save-info');

RocketChat.callbacks.add('afterSaveMessage', function(message, room) {
	// only call webhook if it is a livechat room
	if (room.t !== 'l' || room.v == null || room.v.token == null) {
		return message;
	}

	// if the message has a token, it was sent from the visitor
	// if not, it was sent from the agent
	if (message.token) {
		if (!RocketChat.settings.get('Livechat_webhook_on_visitor_message')) {
			return message;
		}
	} else if (!RocketChat.settings.get('Livechat_webhook_on_agent_message')) {
		return message;
	}
	// if the message has a type means it is a special message (like the closing comment), so skips
	// unless the settings that handle with visitor navigation history are enabled
	if (message.t && !sendMessageType(message.t)) {
		return message;
	}

	sendToCRM('Message', room, [message]);
	return message;
}, RocketChat.callbacks.priority.MEDIUM, 'livechat-send-crm-message');

RocketChat.callbacks.add('livechat.leadCapture', (room) => {
	if (!RocketChat.settings.get('Livechat_webhook_on_capture')) {
		return room;
	}
	return sendToCRM('LeadCapture', room, false);
}, RocketChat.callbacks.priority.MEDIUM, 'livechat-send-crm-lead-capture');
