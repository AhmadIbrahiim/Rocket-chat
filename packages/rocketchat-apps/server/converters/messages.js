export class AppMessagesConverter {
	constructor(orch) {
		this.orch = orch;
	}

	convertById(msgId) {
		const msg = RocketChat.models.Messages.getOneById(msgId);

		return this.convertMessage(msg);
	}

	convertMessage(msgObj) {
		if (!msgObj) {
			return undefined;
		}

		const room = this.orch.getConverters().get('rooms').convertById(msgObj.rid);

		let sender;
		if (msgObj.u && msgObj.u._id) {
			sender = this.orch.getConverters().get('users').convertById(msgObj.u._id);

			if (!sender) {
				sender = this.orch.getConverters().get('users').convertToApp(msgObj.u);
			}
		}

		let editor;
		if (msgObj.editedBy) {
			editor = this.orch.getConverters().get('users').convertById(msgObj.editedBy._id);
		}

		const attachments = this._convertAttachmentsToApp(msgObj.attachments);

		return {
			id: msgObj._id,
			room,
			sender,
			text: msgObj.msg,
			createdAt: msgObj.ts,
			updatedAt: msgObj._updatedAt,
			editor,
			editedAt: msgObj.editedAt,
			emoji: msgObj.emoji,
			avatarUrl: msgObj.avatar,
			alias: msgObj.alias,
			customFields: msgObj.customFields,
			groupable: msgObj.groupable,
			attachments,
			reactions: msgObj.reactions,
		};
	}

	convertAppMessage(message) {
		if (!message) {
			return undefined;
		}

		const room = RocketChat.models.Rooms.findOneById(message.room.id);

		if (!room) {
			throw new Error('Invalid room provided on the message.');
		}

		let u;
		if (message.sender && message.sender.id) {
			const user = RocketChat.models.Users.findOneById(message.sender.id);

			if (user) {
				u = {
					_id: user._id,
					username: user.username,
					name: user.name,
				};
			} else {
				u = {
					_id: message.sender.id,
					username: message.sender.username,
					name: message.sender.name,
				};
			}
		}

		let editedBy;
		if (message.editor) {
			const editor = RocketChat.models.Users.findOneById(message.editor.id);
			editedBy = {
				_id: editor._id,
				username: editor.username,
			};
		}

		const attachments = this._convertAppAttachments(message.attachments);

		return {
			_id: message.id || Random.id(),
			rid: room._id,
			u,
			msg: message.text,
			ts: message.createdAt || new Date(),
			_updatedAt: message.updatedAt || new Date(),
			editedBy,
			editedAt: message.editedAt,
			emoji: message.emoji,
			avatar: message.avatarUrl,
			alias: message.alias,
			customFields: message.customFields,
			groupable: message.groupable,
			attachments,
			reactions: message.reactions,
		};
	}

	_convertAppAttachments(attachments) {
		if (typeof attachments === 'undefined' || !Array.isArray(attachments)) {
			return undefined;
		}

		return attachments.map((attachment) => ({
			collapsed: attachment.collapsed,
			color: attachment.color,
			text: attachment.text,
			ts: attachment.timestamp,
			message_link: attachment.timestampLink,
			thumb_url: attachment.thumbnailUrl,
			author_name: attachment.author ? attachment.author.name : undefined,
			author_link: attachment.author ? attachment.author.link : undefined,
			author_icon: attachment.author ? attachment.author.icon : undefined,
			title: attachment.title ? attachment.title.value : undefined,
			title_link: attachment.title ? attachment.title.link : undefined,
			title_link_download: attachment.title ? attachment.title.displayDownloadLink : undefined,
			image_url: attachment.imageUrl,
			audio_url: attachment.audioUrl,
			video_url: attachment.videoUrl,
			fields: attachment.fields,
			actions: attachment.actions,
			type: attachment.type,
			description: attachment.description,
		})).map((a) => {
			Object.keys(a).forEach((k) => {
				if (typeof a[k] === 'undefined') {
					delete a[k];
				}
			});

			return a;
		});
	}

	_convertAttachmentsToApp(attachments) {
		if (typeof attachments === 'undefined' || !Array.isArray(attachments)) {
			return undefined;
		}

		return attachments.map((attachment) => {
			let author;
			if (attachment.author_name || attachment.author_link || attachment.author_icon) {
				author = {
					name: attachment.author_name,
					link: attachment.author_link,
					icon: attachment.author_icon,
				};
			}

			let title;
			if (attachment.title || attachment.title_link || attachment.title_link_download) {
				title = {
					value: attachment.title,
					link: attachment.title_link,
					displayDownloadLink: attachment.title_link_download,
				};
			}

			return {
				collapsed: attachment.collapsed,
				color: attachment.color,
				text: attachment.text,
				timestamp: attachment.ts,
				timestampLink: attachment.message_link,
				thumbnailUrl: attachment.thumb_url,
				author,
				title,
				imageUrl: attachment.image_url,
				audioUrl: attachment.audio_url,
				videoUrl: attachment.video_url,
				fields: attachment.fields,
				actions: attachment.actions,
				type: attachment.type,
				description: attachment.description,
			};
		});
	}
}
