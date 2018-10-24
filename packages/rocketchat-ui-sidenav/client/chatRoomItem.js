Template.chatRoomItem.helpers({
	roomData() {
		let { name } = this;
		if (this.fname) {
			const realNameForDirectMessages = this.t === 'd' && RocketChat.settings.get('UI_Use_Real_Name');
			const realNameForChannel = this.t !== 'd' && RocketChat.settings.get('UI_Allow_room_names_with_special_chars');
			if (realNameForDirectMessages || realNameForChannel) {
				name = this.fname;
			}
		}

		const openedRoom = Tracker.nonreactive(() => Session.get('openedRoom'));
		const unread = this.unread > 0 ? this.unread : false;
		// if (this.unread > 0 && (!hasFocus || openedRoom !== this.rid)) {
		// 	unread = this.unread;
		// }

		const active = [this.rid, this._id].includes((id) => id === openedRoom);

		const archivedClass = this.archived ? 'archived' : false;

		this.alert = !this.hideUnreadStatus && this.alert; // && (!hasFocus || FlowRouter.getParam('_id') !== this.rid);

		const icon = RocketChat.roomTypes.getIcon(this.t);
		const avatar = !icon;

		const roomData = {
			...this,
			icon,
			avatar,
			username : this.name,
			route: RocketChat.roomTypes.getRouteLink(this.t, this),
			name: name || RocketChat.roomTypes.getRoomName(this.t, this),
			unread,
			active,
			archivedClass,
			status: this.t === 'd' || this.t === 'l',
		};
		roomData.username = roomData.username || roomData.name;

		if (!this.lastMessage && RocketChat.settings.get('Store_Last_Message')) {
			const room = RocketChat.models.Rooms.findOne(this.rid || this._id, { fields: { lastMessage: 1 } });
			roomData.lastMessage = (room && room.lastMessage) || { msg: t('No_messages_yet') };
		}
		return roomData;
	},
});

RocketChat.callbacks.add('enter-room', (sub) => {
	const items = $('.rooms-list .sidebar-item');
	items.filter('.sidebar-item--active').removeClass('sidebar-item--active');
	if (sub) {
		items.filter(`[data-id=${ sub._id }]`).addClass('sidebar-item--active');
	}
	return sub;
});
