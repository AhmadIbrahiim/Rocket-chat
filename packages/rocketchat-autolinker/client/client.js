import s from 'underscore.string';

//
// AutoLinker is a named function that will replace links on messages
// @param {Object} message - The message object
//

import Autolinker from 'autolinker';

function AutoLinker(message) {
	if (RocketChat.settings.get('AutoLinker') !== true) {
		return message;
	}

	if (s.trim(message.html)) {
		const regUrls = new RegExp(RocketChat.settings.get('AutoLinker_UrlsRegExp'));

		const autolinker = new Autolinker({
			stripPrefix: RocketChat.settings.get('AutoLinker_StripPrefix'),
			urls: {
				schemeMatches: RocketChat.settings.get('AutoLinker_Urls_Scheme'),
				wwwMatches: RocketChat.settings.get('AutoLinker_Urls_www'),
				tldMatches: RocketChat.settings.get('AutoLinker_Urls_TLD'),
			},
			email: RocketChat.settings.get('AutoLinker_Email'),
			phone: RocketChat.settings.get('AutoLinker_Phone'),
			twitter: false,
			stripTrailingSlash: false,
			replaceFn(match) {
				if (match.getType() === 'url') {
					if (regUrls.test(match.matchedText)) {
						if (match.matchedText.indexOf(Meteor.absoluteUrl()) === 0) {
							// returns an `Autolinker.HtmlTag` instance for an <a> tag
							const tag = match.buildTag();
							// sets target to empty, instead of _blank
							tag.setAttr('target', '');
							return tag;
						}

						return true;
					}
				}

				return null;
			},
		});

		let regNonAutoLink = /(```\w*[\n ]?[\s\S]*?```+?)|(`(?:[^`]+)`)/;
		if (RocketChat.settings.get('Katex_Enabled')) {
			regNonAutoLink = /(```\w*[\n ]?[\s\S]*?```+?)|(`(?:[^`]+)`)|(\\\(\w*[\n ]?[\s\S]*?\\\)+?)/;
		}

		// Separate text in code blocks and non code blocks
		const msgParts = message.html.split(regNonAutoLink);

		msgParts.forEach((part, index) => {
			if (part && part.length > 0) {
				// Verify if this part is code
				const codeMatch = part.match(regNonAutoLink);
				if (!codeMatch) {
					msgParts[index] = autolinker.link(part);
				}
			}
		});

		// Re-mount message
		message.html = msgParts.join('');
	}

	return message;
}

RocketChat.callbacks.add('renderMessage', AutoLinker, RocketChat.callbacks.priority.LOW, 'autolinker');
