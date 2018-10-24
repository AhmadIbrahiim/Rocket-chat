/* global renderMessageBody:true */
import s from 'underscore.string';

renderMessageBody = function(msg) {
	msg.html = msg.msg;

	if (s.trim(msg.html) !== '') {
		msg.html = s.escapeHTML(msg.html);
	}

	const message = RocketChat.callbacks.run('renderMessage', msg);

	if (message.tokens && message.tokens.length > 0) {
		// Unmounting tokens(LIFO)
		for (const { token, text } of message.tokens.reverse()) {
			message.html = message.html.replace(token, () => text); // Uses lambda so doesn't need to escape $
		}
	}

	return msg.html;
};

/* exported renderMessageBody */
