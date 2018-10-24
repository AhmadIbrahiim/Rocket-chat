Meteor.methods({
	removeWebdavAccount(accountId) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid User', { method: 'removeWebdavAccount' });
		}
		// if (!RocketChat.settings.get('Webdav_Integration_Enabled')) {
		// 	throw new Meteor.Error('error-not-allowed', 'WebDAV Integration Not Allowed', {method: 'removeWebdavAccount'});
		// }
		check(accountId, String);

		return RocketChat.models.WebdavAccounts.removeByUserAndId(accountId, Meteor.userId());
	},
});
