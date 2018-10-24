/* globals FlowRouter, RoomHistoryManager */
import _ from 'underscore';

Meteor.startup(function() {
	RocketChat.MessageAction.addButton({
		id: 'jump-to-search-message',
		icon: 'jump',
		label: 'Jump_to_message',
		context: ['search'],
		action() {
			const message = this._arguments[1];
			if (Session.get('openedRoom') === message.rid) {
				return RoomHistoryManager.getSurroundingMessages(message, 50);
			}

			FlowRouter.goToRoomById(message.rid);
			// RocketChat.MessageAction.hideDropDown();

			if (window.matchMedia('(max-width: 500px)').matches) {
				Template.instance().tabBar.close();
			}

			window.setTimeout(() => {
				RoomHistoryManager.getSurroundingMessages(message, 50);
			}, 400);
			// 400ms is popular among game devs as a good delay before transition starts
			// ie. 50, 100, 200, 400, 800 are the favored timings
		},
		order: 100,
		group: 'menu',
	});
});

Template.DefaultSearchResultTemplate.onCreated(function() {
	const self = this;

	// paging
	this.pageSize = this.data.settings.PageSize;

	// global search
	this.globalSearchEnabled = this.data.settings.GlobalSearchEnabled;
	this.data.parentPayload.searchAll = this.globalSearchEnabled;

	this.hasMore = new ReactiveVar(true);

	this.autorun(() => {
		const result = this.data.result.get();
		self.hasMore.set(!(result && result.message.docs.length < (self.data.payload.limit || self.pageSize)));
	});
});

Template.DefaultSearchResultTemplate.events({
	'change #global-search'(e, t) {
		t.data.parentPayload.searchAll = e.target.checked;
		t.data.payload.limit = t.pageSize;
		t.data.result.set(undefined);
		t.data.search();

	},
	'scroll .rocket-default-search-results': _.throttle(function(e, t) {
		if (e.target.scrollTop >= (e.target.scrollHeight - e.target.clientHeight) && t.hasMore.get()) {
			t.data.payload.limit = (t.data.payload.limit || t.pageSize) + t.pageSize;
			t.data.search();
		}
	}, 200),
});

Template.DefaultSearchResultTemplate.helpers({
	result() {
		return Template.instance().data.result.get();
	},
	globalSearchEnabled() {
		return Template.instance().globalSearchEnabled;
	},
	searching() {
		return Template.instance().data.searching.get();
	},
	hasMore() {
		return Template.instance().hasMore.get();
	},
	message() {
		return { customClass: 'search', actionContext: 'search', ...this };
	},
});
