import Webdav from 'webdav';

Meteor.methods({
	async addWebdavAccount(formData) {

		const userId = Meteor.userId();

		if (!userId) {
			throw new Meteor.Error('error-invalid-user', 'Invalid User', { method: 'addWebdavAccount' });
		}

		if (!RocketChat.settings.get('Webdav_Integration_Enabled')) {
			throw new Meteor.Error('error-not-allowed', 'WebDAV Integration Not Allowed', { method: 'addWebdavAccount' });
		}

		check(formData, Match.ObjectIncluding({
			serverURL: String,
			username: String,
			pass: String,
		}));

		const client = new Webdav(
			formData.serverURL,
			formData.username,
			formData.pass
		);

		try {
			await client.stat('/');
		} catch (error) {
			return { success: false, message: 'could-not-access-webdav', error };
		}

		const accountData = {
			user_id: userId,
			server_url: formData.serverURL,
			username: formData.username,
			password: formData.pass,
			name: formData.name,
		};
		try {
			RocketChat.models.WebdavAccounts.insert(accountData);
			return { success: true, message: 'webdav-account-saved' };
		} catch (error) {
			return { success: false, message: error.code === 11000 ? 'duplicated-account' : 'unknown-write-error', error };
		}

	},
});
