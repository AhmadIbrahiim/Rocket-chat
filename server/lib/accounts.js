import _ from 'underscore';
import s from 'underscore.string';
import * as Mailer from 'meteor/rocketchat:mailer';

const accountsConfig = {
	forbidClientAccountCreation: true,
	loginExpirationInDays: RocketChat.settings.get('Accounts_LoginExpiration'),
};

Accounts.config(accountsConfig);

Accounts.emailTemplates.siteName = RocketChat.settings.get('Site_Name');

Accounts.emailTemplates.from = `${ RocketChat.settings.get('Site_Name') } <${ RocketChat.settings.get('From_Email') }>`;

Accounts.emailTemplates.userToActivate = {
	subject() {
		const subject = TAPi18n.__('Accounts_Admin_Email_Approval_Needed_Subject_Default');
		const siteName = RocketChat.settings.get('Site_Name');

		return `[${ siteName }] ${ subject }`;
	},

	html(options = {}) {
		const email = options.reason ? 'Accounts_Admin_Email_Approval_Needed_With_Reason_Default' : 'Accounts_Admin_Email_Approval_Needed_Default';

		return Mailer.replace(TAPi18n.__(email), {
			name: s.escapeHTML(options.name),
			email: s.escapeHTML(options.email),
			reason: s.escapeHTML(options.reason),
		});
	},
};

Accounts.emailTemplates.userActivated = {
	subject({ active, username }) {
		const activated = username ? 'Activated' : 'Approved';
		const action = active ? activated : 'Deactivated';
		const subject = `Accounts_Email_${ action }_Subject`;
		const siteName = RocketChat.settings.get('Site_Name');

		return `[${ siteName }] ${ TAPi18n.__(subject) }`;
	},

	html({ active, name, username }) {
		const activated = username ? 'Activated' : 'Approved';
		const action = active ? activated : 'Deactivated';

		return Mailer.replace(TAPi18n.__(`Accounts_Email_${ action }`), {
			name: s.escapeHTML(name),
		});
	},
};


// const verifyEmailHtml = Accounts.emailTemplates.verifyEmail.html;
let verifyEmailTemplate = '';
let enrollAccountTemplate = '';
Meteor.startup(() => {
	Mailer.getTemplate('Verification_Email', (value) => {
		verifyEmailTemplate = value;
	});
	Mailer.getTemplate('Accounts_Enrollment_Email', (value) => {
		enrollAccountTemplate = value;
	});
});
Accounts.emailTemplates.verifyEmail.html = function(user, url) {
	url = url.replace(Meteor.absoluteUrl(), `${ Meteor.absoluteUrl() }login/`);
	return Mailer.wrap(Mailer.replacekey(Mailer.replace(verifyEmailTemplate), 'Verification_Url', url));
};

Accounts.urls.resetPassword = function(token) {
	return Meteor.absoluteUrl(`reset-password/${ token }`);
};

Accounts.emailTemplates.resetPassword.html = Accounts.emailTemplates.resetPassword.text;

Accounts.emailTemplates.enrollAccount.subject = function(user) {
	const subject = RocketChat.settings.get('Accounts_Enrollment_Email_Subject');
	return Mailer.replace(subject, user);
};

Accounts.emailTemplates.enrollAccount.html = function(user = {}/* , url*/) {
	return Mailer.wrap(Mailer.replace(enrollAccountTemplate, {
		name: s.escapeHTML(user.name),
		email: user.emails && user.emails[0] && s.escapeHTML(user.emails[0].address),
	}));
};

Accounts.onCreateUser(function(options, user = {}) {
	RocketChat.callbacks.run('beforeCreateUser', options, user);

	user.status = 'offline';
	user.active = !RocketChat.settings.get('Accounts_ManuallyApproveNewUsers');

	if (!user.name) {
		if (options.profile) {
			if (options.profile.name) {
				user.name = options.profile.name;
			} else if (options.profile.firstName && options.profile.lastName) {
				// LinkedIn format
				user.name = `${ options.profile.firstName } ${ options.profile.lastName }`;
			} else if (options.profile.firstName) {
				// LinkedIn format
				user.name = options.profile.firstName;
			}
		}
	}

	if (user.services) {
		for (const service of Object.values(user.services)) {
			if (!user.name) {
				user.name = service.name || service.username;
			}

			if (!user.emails && service.email) {
				user.emails = [{
					address: service.email,
					verified: true,
				}];
			}
		}
	}

	if (!user.active) {
		const destinations = [];

		RocketChat.models.Roles.findUsersInRole('admin').forEach((adminUser) => {
			if (Array.isArray(adminUser.emails)) {
				adminUser.emails.forEach((email) => {
					destinations.push(`${ adminUser.name }<${ email.address }>`);
				});
			}
		});

		const email = {
			to: destinations,
			from: RocketChat.settings.get('From_Email'),
			subject: Accounts.emailTemplates.userToActivate.subject(),
			html: Accounts.emailTemplates.userToActivate.html(options),
		};

		Mailer.send(email);
	}

	return user;
});

Accounts.insertUserDoc = _.wrap(Accounts.insertUserDoc, function(insertUserDoc, options, user) {
	let roles = [];

	if (Match.test(user.globalRoles, [String]) && user.globalRoles.length > 0) {
		roles = roles.concat(user.globalRoles);
	}

	delete user.globalRoles;

	if (user.services && !user.services.password) {
		const defaultAuthServiceRoles = String(RocketChat.settings.get('Accounts_Registration_AuthenticationServices_Default_Roles')).split(',');
		if (defaultAuthServiceRoles.length > 0) {
			roles = roles.concat(defaultAuthServiceRoles.map((s) => s.trim()));
		}
	}

	if (!user.type) {
		user.type = 'user';
	}

	const _id = insertUserDoc.call(Accounts, options, user);

	user = Meteor.users.findOne({
		_id,
	});

	if (user.username) {
		if (options.joinDefaultChannels !== false && user.joinDefaultChannels !== false) {
			Meteor.runAsUser(_id, function() {
				return Meteor.call('joinDefaultChannels', options.joinDefaultChannelsSilenced);
			});
		}

		if (user.type !== 'visitor') {
			Meteor.defer(function() {
				return RocketChat.callbacks.run('afterCreateUser', user);
			});
		}
	}

	if (roles.length === 0) {
		const hasAdmin = RocketChat.models.Users.findOne({
			roles: 'admin',
			type: 'user',
		}, {
			fields: {
				_id: 1,
			},
		});

		if (hasAdmin) {
			roles.push('user');
		} else {
			roles.push('admin');
			if (RocketChat.settings.get('Show_Setup_Wizard') === 'pending') {
				RocketChat.models.Settings.updateValueById('Show_Setup_Wizard', 'in_progress');
			}
		}
	}

	RocketChat.authz.addUserRoles(_id, roles);

	return _id;
});

Accounts.validateLoginAttempt(function(login) {
	login = RocketChat.callbacks.run('beforeValidateLogin', login);

	if (login.allowed !== true) {
		return login.allowed;
	}

	if (login.user.type === 'visitor') {
		return true;
	}

	if (!!login.user.active !== true) {
		throw new Meteor.Error('error-user-is-not-activated', 'User is not activated', {
			function: 'Accounts.validateLoginAttempt',
		});
	}

	if (!login.user.roles || !Array.isArray(login.user.roles)) {
		throw new Meteor.Error('error-user-has-no-roles', 'User has no roles', {
			function: 'Accounts.validateLoginAttempt',
		});
	}

	if (login.user.roles.includes('admin') === false && login.type === 'password' && RocketChat.settings.get('Accounts_EmailVerification') === true) {
		const validEmail = login.user.emails.filter((email) => email.verified === true);
		if (validEmail.length === 0) {
			throw new Meteor.Error('error-invalid-email', 'Invalid email __email__');
		}
	}

	login = RocketChat.callbacks.run('onValidateLogin', login);

	RocketChat.models.Users.updateLastLoginById(login.user._id);
	Meteor.defer(function() {
		return RocketChat.callbacks.run('afterValidateLogin', login);
	});

	return true;
});

Accounts.validateNewUser(function(user) {
	if (user.type === 'visitor') {
		return true;
	}

	if (RocketChat.settings.get('Accounts_Registration_AuthenticationServices_Enabled') === false && RocketChat.settings.get('LDAP_Enable') === false && !(user.services && user.services.password)) {
		throw new Meteor.Error('registration-disabled-authentication-services', 'User registration is disabled for authentication services');
	}

	return true;
});

Accounts.validateNewUser(function(user) {
	if (user.type === 'visitor') {
		return true;
	}

	let domainWhiteList = RocketChat.settings.get('Accounts_AllowedDomainsList');
	if (_.isEmpty(s.trim(domainWhiteList))) {
		return true;
	}

	domainWhiteList = domainWhiteList.split(',').map((domain) => domain.trim());

	if (user.emails && user.emails.length > 0) {
		const email = user.emails[0].address;
		const inWhiteList = domainWhiteList.some((domain) => email.match(`@${ RegExp.escape(domain) }$`));

		if (inWhiteList === false) {
			throw new Meteor.Error('error-invalid-domain');
		}
	}

	return true;
});
