class ModelReadReceipts extends RocketChat.models._Base {
	constructor(...args) {
		super(...args);

		this.tryEnsureIndex({
			roomId: 1,
			userId: 1,
			messageId: 1,
		}, {
			unique: 1,
		});
	}

	findByMessageId(messageId) {
		return this.find({ messageId });
	}
}

export default new ModelReadReceipts('message_read_receipt');
