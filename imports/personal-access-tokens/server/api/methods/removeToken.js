import { Meteor } from 'meteor/meteor';

Meteor.methods({
	'personalAccessTokens:removeToken'({ tokenName }) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('not-authorized', 'Not Authorized', { method: 'personalAccessTokens:removeToken' });
		}
		if (!RocketChat.settings.get('API_Enable_Personal_Access_Tokens')) {
			throw new Meteor.Error('error-personal-access-tokens-are-current-disabled', 'Personal Access Tokens are currently disabled', { method: 'personalAccessTokens:removeToken' });
		}
		const tokenExist = RocketChat.models.Users.findPersonalAccessTokenByTokenNameAndUserId({
			userId: Meteor.userId(),
			tokenName,
		});
		if (!tokenExist) {
			throw new Meteor.Error('error-token-does-not-exists', 'Token does not exist', { method: 'personalAccessTokens:removeToken' });
		}
		RocketChat.models.Users.removePersonalAccessTokenOfUser({
			userId: Meteor.userId(),
			loginTokenObject: {
				type: 'personalAccessToken',
				name: tokenName,
			},
		});
	},
});
