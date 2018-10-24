/* globals logger:true */

logger = new Logger('CAS', {});

Meteor.startup(function() {
	RocketChat.settings.addGroup('CAS', function() {
		this.add('CAS_enabled', false, { type: 'boolean', group: 'CAS', public: true });
		this.add('CAS_base_url', '', { type: 'string', group: 'CAS', public: true });
		this.add('CAS_login_url', '', { type: 'string', group: 'CAS', public: true });
		this.add('CAS_version', '1.0', { type: 'select', values: [{ key: '1.0', i18nLabel: '1.0' }, { key: '2.0', i18nLabel: '2.0' }], group: 'CAS' });

		this.section('Attribute_handling', function() {
			// Enable/disable sync
			this.add('CAS_Sync_User_Data_Enabled', true, { type: 'boolean' });
			// Attribute mapping table
			this.add('CAS_Sync_User_Data_FieldMap', '{}', { type: 'string' });
		});

		this.section('CAS_Login_Layout', function() {
			this.add('CAS_popup_width', '810', { type: 'string', group: 'CAS', public: true });
			this.add('CAS_popup_height', '610', { type: 'string', group: 'CAS', public: true });
			this.add('CAS_button_label_text', 'CAS', { type: 'string', group: 'CAS' });
			this.add('CAS_button_label_color', '#FFFFFF', { type: 'color', group: 'CAS' });
			this.add('CAS_button_color', '#13679A', { type: 'color', group: 'CAS' });
			this.add('CAS_autoclose', true, { type: 'boolean', group: 'CAS' });
		});
	});
});

let timer;

function updateServices(/* record*/) {
	if (typeof timer !== 'undefined') {
		Meteor.clearTimeout(timer);
	}

	timer = Meteor.setTimeout(function() {
		const data = {
			// These will pe passed to 'node-cas' as options
			enabled:          RocketChat.settings.get('CAS_enabled'),
			base_url:         RocketChat.settings.get('CAS_base_url'),
			login_url:        RocketChat.settings.get('CAS_login_url'),
			// Rocketchat Visuals
			buttonLabelText:  RocketChat.settings.get('CAS_button_label_text'),
			buttonLabelColor: RocketChat.settings.get('CAS_button_label_color'),
			buttonColor:      RocketChat.settings.get('CAS_button_color'),
			width:            RocketChat.settings.get('CAS_popup_width'),
			height:           RocketChat.settings.get('CAS_popup_height'),
			autoclose:        RocketChat.settings.get('CAS_autoclose'),
		};

		// Either register or deregister the CAS login service based upon its configuration
		if (data.enabled) {
			logger.info('Enabling CAS login service');
			ServiceConfiguration.configurations.upsert({ service: 'cas' }, { $set: data });
		} else {
			logger.info('Disabling CAS login service');
			ServiceConfiguration.configurations.remove({ service: 'cas' });
		}
	}, 2000);
}

RocketChat.settings.get(/^CAS_.+/, (key, value) => {
	updateServices(value);
});
