import { RealAppBridges } from './bridges';
import { AppMethods, AppsRestApi, AppServerNotifier } from './communication';
import { AppMessagesConverter, AppRoomsConverter, AppSettingsConverter, AppUsersConverter } from './converters';
import { AppsLogsModel, AppsModel, AppsPersistenceModel, AppRealStorage, AppRealLogsStorage } from './storage';

import { AppManager } from '@rocket.chat/apps-engine/server/AppManager';

class AppServerOrchestrator {
	constructor() {
		if (RocketChat.models && RocketChat.models.Permissions) {
			RocketChat.models.Permissions.createOrUpdate('manage-apps', ['admin']);
		}

		this._model = new AppsModel();
		this._logModel = new AppsLogsModel();
		this._persistModel = new AppsPersistenceModel();
		this._storage = new AppRealStorage(this._model);
		this._logStorage = new AppRealLogsStorage(this._logModel);

		this._converters = new Map();
		this._converters.set('messages', new AppMessagesConverter(this));
		this._converters.set('rooms', new AppRoomsConverter(this));
		this._converters.set('settings', new AppSettingsConverter(this));
		this._converters.set('users', new AppUsersConverter(this));

		this._bridges = new RealAppBridges(this);

		this._manager = new AppManager(this._storage, this._logStorage, this._bridges);

		this._communicators = new Map();
		this._communicators.set('methods', new AppMethods(this));
		this._communicators.set('notifier', new AppServerNotifier(this));
		this._communicators.set('restapi', new AppsRestApi(this, this._manager));
	}

	getModel() {
		return this._model;
	}

	getPersistenceModel() {
		return this._persistModel;
	}

	getStorage() {
		return this._storage;
	}

	getLogStorage() {
		return this._logStorage;
	}

	getConverters() {
		return this._converters;
	}

	getBridges() {
		return this._bridges;
	}

	getNotifier() {
		return this._communicators.get('notifier');
	}

	getManager() {
		return this._manager;
	}

	isEnabled() {
		return RocketChat.settings.get('Apps_Framework_enabled');
	}

	isLoaded() {
		return this.getManager().areAppsLoaded();
	}

	load() {
		// Don't try to load it again if it has
		// already been loaded
		if (this.isLoaded()) {
			return;
		}

		this._manager.load()
			.then((affs) => console.log(`Loaded the Apps Framework and loaded a total of ${ affs.length } Apps!`))
			.catch((err) => console.warn('Failed to load the Apps Framework and Apps!', err));
	}

	unload() {
		// Don't try to unload it if it's already been
		// unlaoded or wasn't unloaded to start with
		if (!this.isLoaded()) {
			return;
		}

		this._manager.unload()
			.then(() => console.log('Unloaded the Apps Framework.'))
			.catch((err) => console.warn('Failed to unload the Apps Framework!', err));
	}
}

RocketChat.settings.addGroup('General', function() {
	this.section('Apps', function() {
		this.add('Apps_Framework_enabled', true, {
			type: 'boolean',
			hidden: false,
		});
	});
});

RocketChat.settings.get('Apps_Framework_enabled', (key, isEnabled) => {
	// In case this gets called before `Meteor.startup`
	if (!global.Apps) {
		return;
	}

	if (isEnabled) {
		global.Apps.load();
	} else {
		global.Apps.unload();
	}
});

Meteor.startup(function _appServerOrchestrator() {
	global.Apps = new AppServerOrchestrator();

	if (global.Apps.isEnabled()) {
		global.Apps.load();
	}
});
