/* globals fireGlobalEvent*/

const isSubscribed = (_id) => ChatSubscription.find({ rid: _id }).count() > 0;

const favoritesEnabled = () => RocketChat.settings.get('Favorite_Rooms');

Template.header.helpers({
	back() {
		return Template.instance().data.back;
	},
	avatarBackground() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!roomData) { return ''; }
		return RocketChat.roomTypes.getSecondaryRoomName(roomData.t, roomData) || RocketChat.roomTypes.getRoomName(roomData.t, roomData);
	},
	buttons() {
		return RocketChat.TabBar.getButtons();
	},

	isTranslated() {
		const sub = ChatSubscription.findOne({ rid: this._id }, { fields: { autoTranslate: 1, autoTranslateLanguage: 1 } });
		return RocketChat.settings.get('AutoTranslate_Enabled') && ((sub != null ? sub.autoTranslate : undefined) === true) && (sub.autoTranslateLanguage != null);
	},

	state() {
		const sub = ChatSubscription.findOne({ rid: this._id }, { fields: { f: 1 } });
		if (((sub != null ? sub.f : undefined) != null) && sub.f && favoritesEnabled()) { return ' favorite-room'; }
		return 'empty';
	},

	favoriteLabel() {
		const sub = ChatSubscription.findOne({ rid: this._id }, { fields: { f: 1 } });
		if (((sub != null ? sub.f : undefined) != null) && sub.f && favoritesEnabled()) { return 'Unfavorite'; }
		return 'Favorite';
	},

	isDirect() {
		return RocketChat.models.Rooms.findOne(this._id).t === 'd';
	},

	roomName() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!roomData) { return ''; }

		return RocketChat.roomTypes.getRoomName(roomData.t, roomData);
	},

	secondaryName() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!roomData) { return ''; }

		return RocketChat.roomTypes.getSecondaryRoomName(roomData.t, roomData);
	},

	roomTopic() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!roomData) { return ''; }
		return roomData.topic;
	},

	channelIcon() {
		const roomType = RocketChat.models.Rooms.findOne(this._id).t;
		switch (roomType) {
			case 'd':
				return 'at';
			case 'p':
				return 'lock';
			case 'c':
				return 'hashtag';
			case 'l':
				return 'livechat';
			default:
				return RocketChat.roomTypes.getIcon(roomType);
		}
	},

	roomIcon() {
		const roomData = Session.get(`roomData${ this._id }`);
		if (!(roomData != null ? roomData.t : undefined)) { return ''; }

		return RocketChat.roomTypes.getIcon(roomData != null ? roomData.t : undefined);
	},

	encryptedChannel() {
		const roomData = Session.get(`roomData${ this._id }`);
		return roomData && roomData.encrypted;
	},

	userStatus() {
		const roomData = Session.get(`roomData${ this._id }`);
		return RocketChat.roomTypes.getUserStatus(roomData.t, this._id) || t('offline');
	},

	showToggleFavorite() {
		if (isSubscribed(this._id) && favoritesEnabled()) { return true; }
	},

	fixedHeight() {
		return Template.instance().data.fixedHeight;
	},

	fullpage() {
		return Template.instance().data.fullpage;
	},

	isChannel() {
		return Template.instance().currentChannel != null;
	},

	isSection() {
		return Template.instance().data.sectionName != null;
	},
});

Template.header.events({
	'click .iframe-toolbar .js-iframe-action'(e) {
		fireGlobalEvent('click-toolbar-button', { id: this.id });
		e.currentTarget.querySelector('button').blur();
		return false;
	},

	'click .rc-header__toggle-favorite'(event) {
		event.stopPropagation();
		event.preventDefault();
		return Meteor.call(
			'toggleFavorite',
			this._id,
			!$(event.currentTarget).hasClass('favorite-room'),
			(err) => err && handleError(err)
		);
	},

	'click .edit-room-title'(event) {
		event.preventDefault();
		Session.set('editRoomTitle', true);
		$('.rc-header').addClass('visible');
		return Meteor.setTimeout(() =>
			$('#room-title-field')
				.focus()
				.select(),
		10);
	},
});

Template.header.onCreated(function() {
	this.currentChannel = (this.data && this.data._id && RocketChat.models.Rooms.findOne(this.data._id)) || undefined;
});
