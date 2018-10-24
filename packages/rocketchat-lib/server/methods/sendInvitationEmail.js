import * as Mailer from 'meteor/rocketchat:mailer';
let html = '';
Meteor.startup(() => {
	Mailer.getTemplate('Invitation_Email', (value) => {
		html = value;
	});
});

Meteor.methods({
	sendInvitationEmail(emails) {
		check(emails, [String]);
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'sendInvitationEmail',
			});
		}
		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'bulk-register-user')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'sendInvitationEmail',
			});
		}
		const validEmails = emails.filter(Mailer.checkAddressFormat);

		const subject = RocketChat.settings.get('Invitation_Subject');

		return validEmails.filter((email) => {
			try {
				return Mailer.send({
					to: email,
					from: RocketChat.settings.get('From_Email'),
					subject,
					html,
					data: {
						email,
					},
				});
			} catch ({ message }) {
				throw new Meteor.Error('error-email-send-failed', `Error trying to send email: ${ message }`, {
					method: 'sendInvitationEmail',
					message,
				});
			}
		});
	},
});
