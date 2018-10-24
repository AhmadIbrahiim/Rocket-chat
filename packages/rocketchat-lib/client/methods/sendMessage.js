import s from 'underscore.string';

Meteor.methods({
	sendMessage(message) {
		if (!Meteor.userId() || s.trim(message.msg) === '') {
			return false;
		}
		const user = Meteor.user();
		message.ts = isNaN(TimeSync.serverOffset()) ? new Date() : new Date(Date.now() + TimeSync.serverOffset());
		message.u = {
			_id: Meteor.userId(),
			username: user.username,
		};
		if (RocketChat.settings.get('UI_Use_Real_Name')) {
			message.u.name = user.name;
		}
		message.temp = true;
		if (RocketChat.settings.get('Message_Read_Receipt_Enabled')) {
			message.unread = true;
		}
		message = RocketChat.callbacks.run('beforeSaveMessage', message);
		RocketChat.promises.run('onClientMessageReceived', message).then(function(message) {
			ChatMessage.insert(message);
			return RocketChat.callbacks.run('afterSaveMessage', message);
		});
	},
});
