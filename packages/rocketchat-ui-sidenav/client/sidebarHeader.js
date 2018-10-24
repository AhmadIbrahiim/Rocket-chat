/* globals popover menu */
const setStatus = (status) => {
	if (['Happy', 'Sad', 'Confused', 'Angry'].includes(status)) {
		localStorage.setItem(status, (parseInt(localStorage.getItem(status)) || 0) + 1);
	}
	AccountBox.setStatus(status);
	RocketChat.callbacks.run('userStatusManuallySet', status);
	popover.close();
};

const statusCount = (status) => (Number(localStorage.getItem(status)) <= 0 ? '' : localStorage.getItem(status));

const viewModeIcon = {
	extended: 'th-list',
	medium: 'list',
	condensed: 'list-alt',
};

const extendedViewOption = (user) => {
	if (RocketChat.settings.get('Store_Last_Message')) {
		return {
			icon: viewModeIcon.extended,
			name: t('Extended'),
			modifier: RocketChat.getUserPreference(user, 'sidebarViewMode') === 'extended' ? 'bold' : null,
			action: () => {
				Meteor.call('saveUserPreferences', { sidebarViewMode: 'extended' }, function(error) {
					if (error) {
						return handleError(error);
					}
				});
			},
		};
	}

	return;
};


const toolbarButtons = (user) => [
	{
		name: t('Custom'),
		icon: 'smiley',
		action: (e) => {
			const adminOption = {
				icon: 'customize',
				name: t('Administration'),
				type: 'open',
				id: 'administration',
				action: () => {
					SideNav.setFlex('adminFlex');
					SideNav.openFlex();
					FlowRouter.go('admin-info');
					popover.close();
				},
			};

			const user = Meteor.user();
			const config = {
				popoverClass: 'sidebar-header',
				columns: [
					{
						groups: [
							{
								title: t('User'),
								items: [
									{
										icon: 'happy',
										name: t(`${ statusCount('Happy') } Happy`),
										modifier: 'happy',
										action: () => setStatus('Happy'),
									},
									{
										icon: 'sad',
										name: t(`${ statusCount('Sad') } Sad`),
										modifier: 'Sad',
										action: () => setStatus('Sad'),
									},
									{
										icon: 'confused',
										name: t(`${ statusCount('Confused') } Confused`),
										modifier: 'Confused',
										action: () => setStatus('Confused'),
									},
									{
										icon: 'angry',
										name: t(`${ statusCount('Angry') } Angry`),
										modifier: 'Angry',
										action: () => setStatus('Angry'),
									},
								],
							},
							{
								items: [
									adminOption,
									{
										icon: 'user',
										name: t('My_Account'),
										type: 'open',
										id: 'account',
										action: () => {
											SideNav.setFlex('accountFlex');
											SideNav.openFlex();
											FlowRouter.go('account');
											popover.close();
										},
									},
									{
										icon: 'sign-out',
										name: t('Logout'),
										type: 'open',
										id: 'logout',
										action: () => {
											Meteor.logout(() => {
												RocketChat.callbacks.run('afterLogoutCleanUp', user);
												Meteor.call('logoutCleanUp', user);
												FlowRouter.go('home');
												popover.close();
											});
										},
									},
								],
							},
						],
					},
				],
				currentTarget: e.currentTarget,
				offsetVertical: e.currentTarget.clientHeight + 10,
			};

			popover.open(config);
		},
	},
	{
		name: t('Search'),
		icon: 'magnifier',
		action: () => {
			const toolbarEl = $('.toolbar');
			toolbarEl.css('display', 'block');
			toolbarEl.find('.rc-input__element').focus();
		},
	},
	{
		name: t('Directory'),
		icon: 'globe',
		action: () => {
			menu.close();
			FlowRouter.go('directory');
		},
	},
	{
		name: t('View_mode'),
		icon: () => viewModeIcon[RocketChat.getUserPreference(user, 'sidebarViewMode') || 'condensed'],
		action: (e) => {
			const hideAvatarSetting = RocketChat.getUserPreference(user, 'sidebarHideAvatar');
			const config = {
				columns: [
					{
						groups: [
							{
								items: [
									extendedViewOption(user),
									{
										icon: viewModeIcon.medium,
										name: t('Medium'),
										modifier: RocketChat.getUserPreference(user, 'sidebarViewMode') === 'medium' ? 'bold' : null,
										action: () => {
											Meteor.call('saveUserPreferences', { sidebarViewMode: 'medium' }, function(error) {
												if (error) {
													return handleError(error);
												}
											});
										},
									},
									{
										icon: viewModeIcon.condensed,
										name: t('Condensed'),
										modifier: RocketChat.getUserPreference(user, 'sidebarViewMode') === 'condensed' ? 'bold' : null,
										action: () => {
											Meteor.call('saveUserPreferences', { sidebarViewMode: 'condensed' }, function(error) {
												if (error) {
													return handleError(error);
												}
											});
										},
									},
								],
							},
							{
								items: [
									{
										icon: 'user-rounded',
										name: hideAvatarSetting ? t('Show_Avatars') : t('Hide_Avatars'),
										action: () => {
											Meteor.call('saveUserPreferences', { sidebarHideAvatar: !hideAvatarSetting }, function(error) {
												if (error) {
													return handleError(error);
												}
											});
										},
									},
								],
							},
						],
					},
				],
				currentTarget: e.currentTarget,
				offsetVertical: e.currentTarget.clientHeight + 10,
			};

			popover.open(config);
		},
	},
	{
		name: t('Sort'),
		icon: 'sort',
		action: (e) => {
			const options = [];
			const config = {
				template: 'sortlist',
				currentTarget: e.currentTarget,
				data: {
					options,
				},
				offsetVertical: e.currentTarget.clientHeight + 10,
			};
			popover.open(config);
		},
	},
	{
		name: t('Create_A_New_Channel'),
		icon: 'edit-rounded',
		condition: () => RocketChat.authz.hasAtLeastOnePermission(['create-c', 'create-p']),
		action: () => {
			menu.close();
			FlowRouter.go('create-channel');
		},
	},
	{
		name: t('Options'),
		icon: 'menu',
		condition: () => AccountBox.getItems().length || RocketChat.authz.hasAtLeastOnePermission(['manage-emoji', 'manage-integrations', 'manage-oauth-apps', 'manage-own-integrations', 'manage-sounds', 'view-logs', 'view-privileged-setting', 'view-room-administration', 'view-statistics', 'view-user-administration']),
		action: (e) => {
			let adminOption;
			if (RocketChat.authz.hasAtLeastOnePermission(['manage-emoji', 'manage-integrations', 'manage-oauth-apps', 'manage-own-integrations', 'manage-sounds', 'view-logs', 'view-privileged-setting', 'view-room-administration', 'view-statistics', 'view-user-administration'])) {
				adminOption = {
					icon: 'customize',
					name: t('Administration'),
					type: 'open',
					id: 'administration',
					action: () => {
						SideNav.setFlex('adminFlex');
						SideNav.openFlex();
						FlowRouter.go('admin-info');
						popover.close();
					},
				};
			}

			const config = {
				popoverClass: 'sidebar-header',
				columns: [
					{
						groups: [
							{
								items: AccountBox.getItems().map((item) => {
									let action;

									if (item.href) {
										action = () => {
											FlowRouter.go(item.href);
											popover.close();
										};
									}

									if (item.sideNav) {
										action = () => {
											SideNav.setFlex(item.sideNav);
											SideNav.openFlex();
											popover.close();
										};
									}

									return {
										icon: item.icon,
										name: t(item.name),
										type: 'open',
										id: item.name,
										href: item.href,
										sideNav: item.sideNav,
										action,
									};
								}).concat([adminOption]),
							},
						],
					},
				],
				currentTarget: e.currentTarget,
				offsetVertical: e.currentTarget.clientHeight + 10,
			};

			popover.open(config);
		},
	}];
Template.sidebarHeader.helpers({
	myUserInfo() {
		const id = Meteor.userId();

		if (id == null && RocketChat.settings.get('Accounts_AllowAnonymousRead')) {
			return {
				username: 'anonymous',
				status: 'online',
			};
		}
		return id && Meteor.users.findOne(id, {
			fields: {
				username: 1, status: 1,
			},
		});
	},
	toolbarButtons() {
		return toolbarButtons(Meteor.userId()).filter((button) => !button.condition || button.condition());
	},
});

Template.sidebarHeader.events({
	'click .js-button'(e) {
		if (document.activeElement === e.currentTarget) {
			e.currentTarget.blur();
		}
		return this.action && this.action.apply(this, [e]);
	},
	'click .sidebar__header .avatar'(e) {
		if (!(Meteor.userId() == null && RocketChat.settings.get('Accounts_AllowAnonymousRead'))) {
			const user = Meteor.user();
			const config = {
				popoverClass: 'sidebar-header',
				columns: [
					{
						groups: [
							{
								title: t('User'),
								items: [
									{
										icon: 'circle',
										name: t('online'),
										modifier: 'online',
										action: () => setStatus('online'),
									},
									{
										icon: 'circle',
										name: t('away'),
										modifier: 'away',
										action: () => setStatus('away'),
									},
									{
										icon: 'circle',
										name: t('busy'),
										modifier: 'busy',
										action: () => setStatus('busy'),
									},
									{
										icon: 'circle',
										name: t('invisible'),
										modifier: 'offline',
										action: () => setStatus('offline'),
									},
								],
							},
							{
								items: [
									{
										icon: 'user',
										name: t('My_Account'),
										type: 'open',
										id: 'account',
										action: () => {
											SideNav.setFlex('accountFlex');
											SideNav.openFlex();
											FlowRouter.go('account');
											popover.close();
										},
									},
									{
										icon: 'sign-out',
										name: t('Logout'),
										type: 'open',
										id: 'logout',
										action: () => {
											Meteor.logout(() => {
												RocketChat.callbacks.run('afterLogoutCleanUp', user);
												Meteor.call('logoutCleanUp', user);
												FlowRouter.go('home');
												popover.close();
											});
										},
									},
								],
							},
						],
					},
				],
				currentTarget: e.currentTarget,
				offsetVertical: e.currentTarget.clientHeight + 10,
			};

			popover.open(config);
		}
	},
});
