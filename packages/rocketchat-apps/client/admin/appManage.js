import _ from 'underscore';
import s from 'underscore.string';
import toastr from 'toastr';

import { AppEvents } from '../communication';
import { Utilities } from '../../lib/misc/Utilities';

import semver from 'semver';

const HOST = 'https://marketplace.rocket.chat'; // TODO move this to inside RocketChat.API

function getApps(instance) {
	const id = instance.id.get();

	return Promise.all([
		fetch(`${ HOST }/v1/apps/${ id }?version=${ RocketChat.Info.marketplaceApiVersion }`).then((data) => data.json()),
		RocketChat.API.get('apps/').then((result) => result.apps.filter((app) => app.id === id)),
	]).then(([remoteApps, [localApp]]) => {
		remoteApps = remoteApps.filter((app) => semver.satisfies(RocketChat.Info.marketplaceApiVersion, app.requiredApiVersion)).sort((a, b) => {
			if (semver.gt(a.version, b.version)) {
				return -1;
			}
			if (semver.lt(a.version, b.version)) {
				return 1;
			}
			return 0;
		});

		const remoteApp = remoteApps[0];
		if (localApp) {
			localApp.installed = true;
			if (remoteApp) {
				localApp.categories = remoteApp.categories;
				if (semver.gt(remoteApp.version, localApp.version)) {
					localApp.newVersion = remoteApp.version;
				}
			}

			instance.onSettingUpdated({ appId: id });

			window.Apps.getWsListener().unregisterListener(AppEvents.APP_STATUS_CHANGE, instance.onStatusChanged);
			window.Apps.getWsListener().unregisterListener(AppEvents.APP_SETTING_UPDATED, instance.onSettingUpdated);
			window.Apps.getWsListener().registerListener(AppEvents.APP_STATUS_CHANGE, instance.onStatusChanged);
			window.Apps.getWsListener().registerListener(AppEvents.APP_SETTING_UPDATED, instance.onSettingUpdated);
		}

		instance.app.set(localApp || remoteApp);

		instance.ready.set(true);
	}).catch((e) => {
		instance.hasError.set(true);
		instance.theError.set(e.message);
	});
}

Template.appManage.onCreated(function() {
	const instance = this;
	this.id = new ReactiveVar(FlowRouter.getParam('appId'));
	this.ready = new ReactiveVar(false);
	this.hasError = new ReactiveVar(false);
	this.theError = new ReactiveVar('');
	this.processingEnabled = new ReactiveVar(false);
	this.app = new ReactiveVar({});
	this.appsList = new ReactiveVar([]);
	this.settings = new ReactiveVar({});
	this.apis = new ReactiveVar([]);
	this.loading = new ReactiveVar(false);

	const id = this.id.get();

	this.getApis = async() => {
		this.apis.set(await window.Apps.getAppApis(id));
	};

	this.getApis();

	this.__ = (key, options, lang_tag) => {
		const appKey = Utilities.getI18nKeyForApp(key, id);
		return TAPi18next.exists(`project:${ appKey }`) ? TAPi18n.__(appKey, options, lang_tag) : TAPi18n.__(key, options, lang_tag);
	};

	function _morphSettings(settings) {
		Object.keys(settings).forEach((k) => {
			settings[k].i18nPlaceholder = settings[k].i18nPlaceholder || ' ';
			settings[k].value = settings[k].value !== undefined && settings[k].value !== null ? settings[k].value : settings[k].packageValue;
			settings[k].oldValue = settings[k].value;
			settings[k].hasChanged = false;
		});

		instance.settings.set(settings);
	}

	getApps(instance);

	instance.onStatusChanged = function _onStatusChanged({ appId, status }) {
		if (appId !== id) {
			return;
		}

		const app = instance.app.get();
		app.status = status;
		instance.app.set(app);
	};

	instance.onSettingUpdated = function _onSettingUpdated({ appId }) {
		if (appId !== id) {
			return;
		}

		RocketChat.API.get(`apps/${ id }/settings`).then((result) => {
			_morphSettings(result.settings);
		});
	};
});

Template.apps.onDestroyed(function() {
	const instance = this;

	window.Apps.getWsListener().unregisterListener(AppEvents.APP_STATUS_CHANGE, instance.onStatusChanged);
	window.Apps.getWsListener().unregisterListener(AppEvents.APP_SETTING_UPDATED, instance.onSettingUpdated);
});

Template.appManage.helpers({
	_(key, ...args) {
		const options = (args.pop()).hash;
		if (!_.isEmpty(args)) {
			options.sprintf = args;
		}

		return Template.instance().__(key, options);
	},
	languages() {
		const languages = TAPi18n.getLanguages();

		let result = Object.keys(languages).map((key) => {
			const language = languages[key];
			return _.extend(language, { key });
		});

		result = _.sortBy(result, 'key');
		result.unshift({
			name: 'Default',
			en: 'Default',
			key: '',
		});
		return result;
	},
	appLanguage(key) {
		const setting = RocketChat.settings.get('Language');
		return setting && setting.split('-').shift().toLowerCase() === key;
	},
	selectedOption(_id, val) {
		const settings = Template.instance().settings.get();
		return settings[_id].value === val;
	},
	getColorVariable(color) {
		return color.replace(/theme-color-/, '@');
	},
	dirty() {
		const t = Template.instance();
		const settings = t.settings.get();
		return Object.keys(settings).some((k) => settings[k].hasChanged);
	},
	disabled() {
		const t = Template.instance();
		const settings = t.settings.get();
		return !Object.keys(settings).some((k) => settings[k].hasChanged);
	},
	isReady() {
		if (Template.instance().ready) {
			return Template.instance().ready.get();
		}

		return false;
	},
	hasError() {
		if (Template.instance().hasError) {
			return Template.instance().hasError.get();
		}

		return false;
	},
	theError() {
		if (Template.instance().theError) {
			return Template.instance().theError.get();
		}

		return '';
	},
	isProcessingEnabled() {
		if (Template.instance().processingEnabled) {
			return Template.instance().processingEnabled.get();
		}

		return false;
	},
	isEnabled() {
		if (!Template.instance().app) {
			return false;
		}

		const info = Template.instance().app.get();

		return info.status === 'auto_enabled' || info.status === 'manually_enabled';
	},
	isInstalled() {
		const instance = Template.instance();

		return instance.app.get().installed === true;
	},
	app() {
		return Template.instance().app.get();
	},
	categories() {
		return Template.instance().app.get().categories;
	},
	settings() {
		return Object.values(Template.instance().settings.get());
	},
	apis() {
		return Template.instance().apis.get();
	},
	parseDescription(i18nDescription) {
		const item = RocketChat.Markdown.parseMessageNotEscaped({ html: Template.instance().__(i18nDescription) });

		item.tokens.forEach((t) => item.html = item.html.replace(t.token, t.text));

		return item.html;
	},
	saving() {
		return Template.instance().loading.get();
	},
	curl(method, api) {
		const example = api.examples[method] || {};
		return Utilities.curl({
			url: Meteor.absoluteUrl.defaultOptions.rootUrl + api.computedPath,
			method,
			params: example.params,
			query: example.query,
			content: example.content,
			headers: example.headers,
		}).split('\n');
	},
	renderMethods(methods) {
		return methods.join('|').toUpperCase();
	},
});

async function setActivate(actiavate, e, t) {
	t.processingEnabled.set(true);

	const el = $(e.currentTarget);
	el.prop('disabled', true);

	const status = actiavate ? 'manually_enabled' : 'manually_disabled';

	try {
		const result = await RocketChat.API.post(`apps/${ t.id.get() }/status`, { status });
		const info = t.app.get();
		info.status = result.status;
		t.app.set(info);
	} catch (e) {
		toastr.error((e.xhr.responseJSON && e.xhr.responseJSON.error) || e.message);
	}
	t.processingEnabled.set(false);
	el.prop('disabled', false);
}

Template.appManage.events({
	'click .expand': (e) => {
		$(e.currentTarget).closest('.section').removeClass('section-collapsed');
		$(e.currentTarget).closest('button').removeClass('expand').addClass('collapse').find('span').text(TAPi18n.__('Collapse'));
		$('.CodeMirror').each((index, codeMirror) => codeMirror.CodeMirror.refresh());
	},

	'click .collapse': (e) => {
		$(e.currentTarget).closest('.section').addClass('section-collapsed');
		$(e.currentTarget).closest('button').addClass('expand').removeClass('collapse').find('span').text(TAPi18n.__('Expand'));
	},

	'click .js-cancel'() {
		FlowRouter.go('/admin/apps');
	},

	'click .js-activate'(e, t) {
		setActivate(true, e, t);
	},

	'click .js-deactivate'(e, t) {
		setActivate(false, e, t);
	},

	'click .js-uninstall': async(e, t) => {
		t.ready.set(false);
		try {
			await RocketChat.API.delete(`apps/${ t.id.get() }`);
			FlowRouter.go('/admin/apps');
		} catch (err) {
			console.warn('Error:', err);
		} finally {
			t.ready.set(true);
		}
	},

	'click .js-install': async(e, t) => {
		const el = $(e.currentTarget);
		el.prop('disabled', true);
		el.addClass('loading');

		const app = t.app.get();

		const url = `${ HOST }/v1/apps/${ t.id.get() }/download/${ app.version }`;

		const api = app.newVersion ? `apps/${ t.id.get() }` : 'apps/';

		RocketChat.API.post(api, { url }).then(() => {
			getApps(t).then(() => {
				el.prop('disabled', false);
				el.removeClass('loading');
			});
		}).catch((e) => {
			el.prop('disabled', false);
			el.removeClass('loading');
			t.hasError.set(true);
			t.theError.set((e.xhr.responseJSON && e.xhr.responseJSON.error) || e.message);
		});

		// play animation
		// TODO this icon and animation are not working
		$(e.currentTarget).find('.rc-icon').addClass('play');
	},

	'click .js-update': (e, t) => {
		FlowRouter.go(`/admin/app/install?isUpdatingId=${ t.id.get() }`);
	},

	'click .js-view-logs': (e, t) => {
		FlowRouter.go(`/admin/apps/${ t.id.get() }/logs`);
	},

	'click .js-cancel-editing': async(e, t) => {
		t.onSettingUpdated({ appId: t.id.get() });
	},

	'click .js-save': async(e, t) => {
		if (t.loading.get()) {
			return;
		}
		t.loading.set(true);
		const settings = t.settings.get();


		try {
			const toSave = [];
			Object.keys(settings).forEach((k) => {
				const setting = settings[k];
				if (setting.hasChanged) {
					toSave.push(setting);
				}
				// return !!setting.hasChanged;
			});

			if (toSave.length === 0) {
				throw 'Nothing to save..';
			}
			const result = await RocketChat.API.post(`apps/${ t.id.get() }/settings`, undefined, { settings: toSave });
			console.log('Updating results:', result);
			result.updated.forEach((setting) => {
				settings[setting.id].value = settings[setting.id].oldValue = setting.value;
			});
			Object.keys(settings).forEach((k) => {
				const setting = settings[k];
				setting.hasChanged = false;
			});
			t.settings.set(settings);

		} catch (e) {
			console.log(e);
		} finally {
			t.loading.set(false);
		}

	},

	'change input[type="checkbox"]': (e, t) => {
		const labelFor = $(e.currentTarget).attr('name');
		const isChecked = $(e.currentTarget).prop('checked');

		// $(`input[name="${ labelFor }"]`).prop('checked', !isChecked);

		const setting = t.settings.get()[labelFor];

		if (setting) {
			setting.value = isChecked;
			t.settings.get()[labelFor].hasChanged = setting.oldValue !== setting.value;
			t.settings.set(t.settings.get());
		}
	},

	'change .rc-select__element' : (e, t) => {
		const labelFor = $(e.currentTarget).attr('name');
		const value = $(e.currentTarget).val();

		const setting = t.settings.get()[labelFor];

		if (setting) {
			setting.value = value;
			t.settings.get()[labelFor].hasChanged = setting.oldValue !== setting.value;
			t.settings.set(t.settings.get());
		}
	},

	'input input, input textarea, change input[type="color"]': _.throttle(function(e, t) {
		let value = s.trim($(e.target).val());

		switch (this.type) {
			case 'int':
				value = parseInt(value);
				break;
			case 'boolean':
				value = value === '1';
				break;
			case 'code':
				value = $(`.code-mirror-box[data-editor-id="${ this.id }"] .CodeMirror`)[0].CodeMirror.getValue();
		}

		const setting = t.settings.get()[this.id];

		if (setting) {
			setting.value = value;

			if (setting.oldValue !== setting.value) {
				t.settings.get()[this.id].hasChanged = true;
				t.settings.set(t.settings.get());
			}
		}
	}, 500),
});
