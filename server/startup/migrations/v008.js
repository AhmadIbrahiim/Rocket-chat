RocketChat.Migrations.add({
	version: 8,
	up() {
		console.log('Load old settings record');
		const settings = RocketChat.models.Settings.findOne({
			_id: 'settings',
		});

		if (settings) {
			if (settings.CDN_PREFIX) {
				RocketChat.models.Settings.insert({ _id: 'CDN_PREFIX', value: settings.CDN_PREFIX, type: 'string', group: 'General' });
			}

			if (settings.ENV && settings.ENV.MAIL_URL) {
				RocketChat.models.Settings.insert({ _id: 'MAIL_URL', value: settings.ENV.MAIL_URL, type: 'string', group: 'SMTP' });
			}

			if (settings.denyUnverifiedEmails) {
				RocketChat.models.Settings.insert({ _id: 'Accounts_denyUnverifiedEmails', value: settings.denyUnverifiedEmails, type: 'boolean', group: 'Accounts' });
			}

			if (settings.public && settings.public.avatarStore && settings.public.avatarStore.type) {
				RocketChat.models.Settings.insert({ _id: 'avatarStore_type', value: settings.public.avatarStore.type, type: 'string', group: 'API' });
			}

			if (settings.public && settings.public.avatarStore && settings.public.avatarStore.path) {
				RocketChat.models.Settings.insert({ _id: 'avatarStore_path', value: settings.public.avatarStore.path, type: 'string', group: 'API' });
			}

			return RocketChat.models.Settings.remove({
				_id: 'settings',
			});
		}
	},
});
