
/* global menu */
import _ from 'underscore';

let isLoading;
let filterText = '';
let usernamesFromClient;
let resultsFromClient;

const selectorSearch = '.toolbar__search .rc-input__element';
Meteor.startup(() => {
	isLoading = new ReactiveVar(false);
});

const toolbarSearch = {
	shortcut: false,
	clear() {
		const $inputMessage = $('.js-input-message');

		if (0 === $inputMessage.length) {
			return;
		}

		$inputMessage.focus();
		$(selectorSearch).val('');

		if (this.shortcut) {
			menu.close();
		}
	},
	focus(fromShortcut) {
		menu.open();
		$('.toolbar').css('display', 'block');
		$(selectorSearch).focus();
		this.shortcut = fromShortcut;
	},
};

this.toolbarSearch = toolbarSearch;

const getFromServer = (cb, type) => {
	isLoading.set(true);
	const currentFilter = filterText;

	Meteor.call('spotlight', currentFilter, usernamesFromClient, type, (err, results) => {
		if (currentFilter !== filterText) {
			return;
		}

		isLoading.set(false);

		if (err) {
			console.log(err);
			return false;
		}

		const resultsFromServer = [];
		const usersLength = results.users.length;
		const roomsLength = results.rooms.length;

		if (usersLength) {
			for (let i = 0; i < usersLength; i++) {
				resultsFromServer.push({
					_id: results.users[i]._id,
					t: 'd',
					name: results.users[i].username,
					fname: results.users[i].name,
				});
			}
		}

		if (roomsLength) {
			for (let i = 0; i < roomsLength; i++) {
				const alreadyOnClient = resultsFromClient.find((item) => item._id === results.rooms[i]._id);
				if (alreadyOnClient) {
					continue;
				}

				resultsFromServer.push({
					_id: results.rooms[i]._id,
					t: results.rooms[i].t,
					name: results.rooms[i].name,
					lastMessage: results.rooms[i].lastMessage,
				});
			}
		}

		if (resultsFromServer.length) {
			cb(resultsFromClient.concat(resultsFromServer));
		}
	});
};

const getFromServerDebounced = _.debounce(getFromServer, 500);

Template.toolbar.helpers({
	results() {
		return Template.instance().resultsList.get();
	},
	getPlaceholder() {
		let placeholder = TAPi18n.__('Search');

		if (!Meteor.Device.isDesktop()) {
			return placeholder;
		} else if (window.navigator.platform.toLowerCase().includes('mac')) {
			placeholder = `${ placeholder } (\u2318+K)`;
		} else {
			placeholder = `${ placeholder } (\u2303+K)`;
		}

		return placeholder;
	},
	popupConfig() {
		const open = new ReactiveVar(false);

		Tracker.autorun(() => {
			if (open.get() === false) {
				toolbarSearch.clear();
			}
		});

		const config = {
			cls: 'search-results-list',
			collection: Meteor.userId() ? RocketChat.models.Subscriptions : RocketChat.models.Rooms,
			template: 'toolbarSearchList',
			sidebar: true,
			emptyTemplate: 'toolbarSearchListEmpty',
			input: '.toolbar__search .rc-input__element',
			cleanOnEnter: true,
			closeOnEsc: true,
			blurOnSelectItem: true,
			isLoading,
			open,
			getFilter(collection, filter, cb) {
				filterText = filter;

				const type = {
					users: true,
					rooms: true,
				};

				const query = {
					rid: {
						$ne: Session.get('openedRoom'),
					},
				};

				if (!Meteor.userId()) {
					query._id = query.rid;
					delete query.rid;
				}
				const searchForChannels = filterText[0] === '#';
				const searchForDMs = filterText[0] === '@';
				if (searchForChannels) {
					filterText = filterText.slice(1);
					type.users = false;
					query.t = 'c';
				}

				if (searchForDMs) {
					filterText = filterText.slice(1);
					type.rooms = false;
					query.t = 'd';
				}

				const searchQuery = new RegExp((RegExp.escape(filterText)), 'i');
				query.$or = [
					{ name: searchQuery },
					{ fname: searchQuery },
				];

				resultsFromClient = collection.find(query, { limit: 20, sort: { unread: -1, ls: -1 } }).fetch();

				const resultsFromClientLength = resultsFromClient.length;
				const user = Meteor.users.findOne(Meteor.userId(), { fields: { name: 1, username:1 } });
				if (user) {
					usernamesFromClient = [user];
				}

				for (let i = 0; i < resultsFromClientLength; i++) {
					if (resultsFromClient[i].t === 'd') {
						usernamesFromClient.push(resultsFromClient[i].name);
					}
				}

				cb(resultsFromClient);

				// Use `filter` here to get results for `#` or `@` filter only
				if (resultsFromClient.length < 20) {
					getFromServerDebounced(cb, type);
				}
			},

			getValue(_id, collection, records) {
				const doc = _.findWhere(records, { _id });

				RocketChat.roomTypes.openRouteLink(doc.t, doc, FlowRouter.current().queryParams);
				menu.close();
			},
		};

		return config;
	},
});

Template.toolbar.events({
	'submit form'(e) {
		e.preventDefault();
		return false;
	},

	'keyup [role="search"] input'(e) {
		if (e.which === 27) {
			e.preventDefault();
			e.stopPropagation();

			toolbarSearch.clear();
			$('.toolbar').css('display', 'none');
		}
	},

	'click [role="search"] input'() {
		toolbarSearch.shortcut = false;
	},

	'click .toolbar__icon-search--right'() {
		toolbarSearch.clear();
		$('.toolbar').css('display', 'none');
	},

	'blur [role="search"] input'() {
		toolbarSearch.clear();
		$('.toolbar').css('display', 'none');
	},

	'click [role="search"] button, touchend [role="search"] button'(e) {
		if (RocketChat.authz.hasAtLeastOnePermission(['create-c', 'create-p'])) {
			// TODO: resolve this name menu/sidebar/sidebav/flex...
			menu.close();
			FlowRouter.go('create-channel');
		} else {
			e.preventDefault();
		}
	},
});
