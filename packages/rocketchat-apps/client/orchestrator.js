import { AppWebsocketReceiver } from './communication';
import { Utilities } from '../lib/misc/Utilities';

class AppClientOrchestrator {
	constructor() {
		this._isLoaded = false;
		this._isEnabled = false;
		this._loadingResolve;
		this._refreshLoading();
	}

	isLoaded() {
		return this._isLoaded;
	}

	isEnabled() {
		return this._isEnabled;
	}

	getLoadingPromise() {
		if (this._isLoaded) {
			return Promise.resolve(this._isEnabled);
		}

		return this._loadingPromise;
	}

	load(isEnabled) {
		console.log('Loading:', isEnabled);
		this._isEnabled = isEnabled;

		// It was already loaded, so let's load it again
		if (this._isLoaded) {
			this._refreshLoading();
		} else {
			this.ws = new AppWebsocketReceiver(this);
			this._addAdminMenuOption();
		}

		Meteor.defer(() => {
			this._loadLanguages().then(() => {
				this._loadingResolve(this._isEnabled);
				this._isLoaded = true;
			});
		});
	}

	getWsListener() {
		return this.ws;
	}

	_refreshLoading() {
		this._loadingPromise = new Promise((resolve) => {
			this._loadingResolve = resolve;
		});
	}

	_addAdminMenuOption() {
		RocketChat.AdminBox.addOption({
			icon: 'cube',
			href: 'apps',
			i18nLabel: 'Apps',
			permissionGranted() {
				return RocketChat.authz.hasAtLeastOnePermission(['manage-apps']);
			},
		});
	}

	_loadLanguages() {
		return RocketChat.API.get('apps/languages').then((info) => {
			info.apps.forEach((rlInfo) => this.parseAndLoadLanguages(rlInfo.languages, rlInfo.id));
		});
	}

	parseAndLoadLanguages(languages, id) {
		Object.entries(languages).forEach(([language, translations]) => {
			try {
				translations = Object.entries(translations).reduce((newTranslations, [key, value]) => {
					newTranslations[Utilities.getI18nKeyForApp(key, id)] = value;
					return newTranslations;
				}, {});

				TAPi18next.addResourceBundle(language, 'project', translations);
			} catch (e) {
				// Failed to parse the json
			}
		});
	}

	async getAppApis(appId) {
		const result = await RocketChat.API.get(`apps/${ appId }/apis`);
		return result.apis;
	}
}

Meteor.startup(function _rlClientOrch() {
	window.Apps = new AppClientOrchestrator();

	RocketChat.CachedCollectionManager.onLogin(() => {
		Meteor.call('apps/is-enabled', (error, isEnabled) => {
			window.Apps.load(isEnabled);
		});
	});
});

const appsRouteAction = function _theRealAction(whichCenter) {
	Meteor.defer(() => window.Apps.getLoadingPromise().then((isEnabled) => {
		if (isEnabled) {
			BlazeLayout.render('main', { center: whichCenter, old: true }); // TODO remove old
		} else {
			FlowRouter.go('app-what-is-it');
		}
	}));
};

// Bah, this has to be done *before* `Meteor.startup`
FlowRouter.route('/admin/apps', {
	name: 'apps',
	action() {
		appsRouteAction('apps');
	},
});

FlowRouter.route('/admin/app/install', {
	name: 'app-install',
	action() {
		appsRouteAction('appInstall');
	},
});

FlowRouter.route('/admin/apps/:appId', {
	name: 'app-manage',
	action() {
		appsRouteAction('appManage');
	},
});

FlowRouter.route('/admin/apps/:appId/logs', {
	name: 'app-logs',
	action() {
		appsRouteAction('appLogs');
	},
});

FlowRouter.route('/admin/app/what-is-it', {
	name: 'app-what-is-it',
	action() {
		Meteor.defer(() => window.Apps.getLoadingPromise().then((isEnabled) => {
			if (isEnabled) {
				FlowRouter.go('apps');
			} else {
				BlazeLayout.render('main', { center: 'appWhatIsIt' });
			}
		}));
	},
});
