/* globals Gravatar */
import _ from 'underscore';
import s from 'underscore.string';
import * as Mailer from 'meteor/rocketchat:mailer';
let html = '';
Meteor.startup(() => {
	Mailer.getTemplate('Accounts_UserAddedEmail_Email', (template) => {
		html = template;
	});
});

function validateUserData(userId, userData) {
	const existingRoles = _.pluck(RocketChat.authz.getRoles(), '_id');

	if (userData._id && userId !== userData._id && !RocketChat.authz.hasPermission(userId, 'edit-other-user-info')) {
		throw new Meteor.Error('error-action-not-allowed', 'Editing user is not allowed', {
			method: 'insertOrUpdateUser',
			action: 'Editing_user',
		});
	}

	if (!userData._id && !RocketChat.authz.hasPermission(userId, 'create-user')) {
		throw new Meteor.Error('error-action-not-allowed', 'Adding user is not allowed', {
			method: 'insertOrUpdateUser',
			action: 'Adding_user',
		});
	}

	if (userData.roles && _.difference(userData.roles, existingRoles).length > 0) {
		throw new Meteor.Error('error-action-not-allowed', 'The field Roles consist invalid role name', {
			method: 'insertOrUpdateUser',
			action: 'Assign_role',
		});
	}

	if (userData.roles && _.indexOf(userData.roles, 'admin') >= 0 && !RocketChat.authz.hasPermission(userId, 'assign-admin-role')) {
		throw new Meteor.Error('error-action-not-allowed', 'Assigning admin is not allowed', {
			method: 'insertOrUpdateUser',
			action: 'Assign_admin',
		});
	}

	if (!userData._id && !s.trim(userData.name)) {
		throw new Meteor.Error('error-the-field-is-required', 'The field Name is required', {
			method: 'insertOrUpdateUser',
			field: 'Name',
		});
	}

	if (!userData._id && !s.trim(userData.username)) {
		throw new Meteor.Error('error-the-field-is-required', 'The field Username is required', {
			method: 'insertOrUpdateUser',
			field: 'Username',
		});
	}

	let nameValidation;

	try {
		nameValidation = new RegExp(`^${ RocketChat.settings.get('UTF8_Names_Validation') }$`);
	} catch (e) {
		nameValidation = new RegExp('^[0-9a-zA-Z-_.]+$');
	}

	if (userData.username && !nameValidation.test(userData.username)) {
		throw new Meteor.Error('error-input-is-not-a-valid-field', `${ _.escape(userData.username) } is not a valid username`, {
			method: 'insertOrUpdateUser',
			input: userData.username,
			field: 'Username',
		});
	}

	if (!userData._id && !userData.password) {
		throw new Meteor.Error('error-the-field-is-required', 'The field Password is required', {
			method: 'insertOrUpdateUser',
			field: 'Password',
		});
	}

	if (!userData._id) {
		if (!RocketChat.checkUsernameAvailability(userData.username)) {
			throw new Meteor.Error('error-field-unavailable', `${ _.escape(userData.username) } is already in use :(`, {
				method: 'insertOrUpdateUser',
				field: userData.username,
			});
		}

		if (userData.email && !RocketChat.checkEmailAvailability(userData.email)) {
			throw new Meteor.Error('error-field-unavailable', `${ _.escape(userData.email) } is already in use :(`, {
				method: 'insertOrUpdateUser',
				field: userData.email,
			});
		}
	}
}

RocketChat.saveUser = function(userId, userData) {
	validateUserData(userId, userData);

	if (!userData._id) {
		RocketChat.validateEmailDomain(userData.email);

		// insert user
		const createUser = {
			username: userData.username,
			password: userData.password,
			joinDefaultChannels: userData.joinDefaultChannels,
		};
		if (userData.email) {
			createUser.email = userData.email;
		}

		const _id = Accounts.createUser(createUser);

		const updateUser = {
			$set: {
				name: userData.name,
				roles: userData.roles || ['user'],
				settings: userData.settings || {},
			},
		};

		if (typeof userData.requirePasswordChange !== 'undefined') {
			updateUser.$set.requirePasswordChange = userData.requirePasswordChange;
		}

		if (typeof userData.verified === 'boolean') {
			updateUser.$set['emails.0.verified'] = userData.verified;
		}

		Meteor.users.update({ _id }, updateUser);

		if (userData.sendWelcomeEmail) {
			const subject = RocketChat.settings.get('Accounts_UserAddedEmail_Subject');

			const email = {
				to: userData.email,
				from: RocketChat.settings.get('From_Email'),
				subject,
				html,
				data: {
					name: s.escapeHTML(userData.name),
					email: s.escapeHTML(userData.email),
					password: s.escapeHTML(userData.password),
				},
			};

			try {
				Mailer.send(email);
			} catch (error) {
				throw new Meteor.Error('error-email-send-failed', `Error trying to send email: ${ error.message }`, {
					function: 'RocketChat.saveUser',
					message: error.message,
				});
			}
		}

		userData._id = _id;

		if (RocketChat.settings.get('Accounts_SetDefaultAvatar') === true && userData.email) {
			const gravatarUrl = Gravatar.imageUrl(userData.email, { default: '404', size: 200, secure: true });

			try {
				RocketChat.setUserAvatar(userData, gravatarUrl, '', 'url');
			} catch (e) {
				// Ignore this error for now, as it not being successful isn't bad
			}
		}

		return _id;
	}
	if (!RocketChat.settings.get('Accounts_AllowUserProfileChange') && !RocketChat.authz.hasPermission(userId, 'edit-other-user-info') && !RocketChat.authz.hasPermission(userId, 'edit-other-user-password')) {
		throw new Meteor.Error('error-action-not-allowed', 'Edit user profile is not allowed', {
			method: 'insertOrUpdateUser',
			action: 'Update_user',
		});
	}

	if (userData.username && !RocketChat.settings.get('Accounts_AllowUsernameChange') && !RocketChat.authz.hasPermission(userId, 'edit-other-user-info')) {
		throw new Meteor.Error('error-action-not-allowed', 'Edit username is not allowed', {
			method: 'insertOrUpdateUser',
			action: 'Update_user',
		});
	}

	if (userData.name && !RocketChat.settings.get('Accounts_AllowRealNameChange') && !RocketChat.authz.hasPermission(userId, 'edit-other-user-info')) {
		throw new Meteor.Error('error-action-not-allowed', 'Edit user real name is not allowed', {
			method: 'insertOrUpdateUser',
			action: 'Update_user',
		});
	}

	if (userData.email && !RocketChat.settings.get('Accounts_AllowEmailChange') && !RocketChat.authz.hasPermission(userId, 'edit-other-user-info')) {
		throw new Meteor.Error('error-action-not-allowed', 'Edit user email is not allowed', {
			method: 'insertOrUpdateUser',
			action: 'Update_user',
		});
	}

	if (userData.password && !RocketChat.settings.get('Accounts_AllowPasswordChange') && !RocketChat.authz.hasPermission(userId, 'edit-other-user-password')) {
		throw new Meteor.Error('error-action-not-allowed', 'Edit user password is not allowed', {
			method: 'insertOrUpdateUser',
			action: 'Update_user',
		});
	}

	// update user
	if (userData.username) {
		RocketChat.setUsername(userData._id, userData.username);
	}

	if (userData.name) {
		RocketChat.setRealName(userData._id, userData.name);
	}

	if (userData.email) {
		const shouldSendVerificationEmailToUser = userData.verified !== true;
		RocketChat.setEmail(userData._id, userData.email, shouldSendVerificationEmailToUser);
	}

	if (userData.password && userData.password.trim() && RocketChat.authz.hasPermission(userId, 'edit-other-user-password') && RocketChat.passwordPolicy.validate(userData.password)) {
		Accounts.setPassword(userData._id, userData.password.trim());
	}

	const updateUser = {
		$set: {},
	};

	if (userData.roles) {
		updateUser.$set.roles = userData.roles;
	}

	if (userData.settings) {
		updateUser.$set.settings = { preferences: userData.settings.preferences };
	}

	if (typeof userData.requirePasswordChange !== 'undefined') {
		updateUser.$set.requirePasswordChange = userData.requirePasswordChange;
	}

	if (typeof userData.verified === 'boolean') {
		updateUser.$set['emails.0.verified'] = userData.verified;
	}

	Meteor.users.update({ _id: userData._id }, updateUser);

	return true;
};
