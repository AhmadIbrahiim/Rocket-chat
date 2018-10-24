/* globals menu popover renderMessageBody */
import moment from 'moment';

Template.sidebarItem.helpers({
	or(...args) {
		args.pop();
		return args.some((arg) => arg);
	},
	streaming() {
		return this.streamingOptions && Object.keys(this.streamingOptions).length;
	},
	isRoom() {
		return this.rid || this._id;
	},
	isExtendedViewMode() {
		return RocketChat.getUserPreference(Meteor.userId(), 'sidebarViewMode') === 'extended';
	},
	lastMessage() {
		return this.lastMessage && Template.instance().renderedMessage;
	},
	lastMessageTs() {
		return this.lastMessage && Template.instance().lastMessageTs.get();
	},
	mySelf() {
		return this.t === 'd' && this.name === Template.instance().user.username;
	},
	isLivechatQueue() {
		return this.pathSection === 'livechat-queue';
	},
});

function timeAgo(time) {
	const now = new Date();
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

	return (
		(now.getDate() === time.getDate() && moment(time).format('LT')) ||
		(yesterday.getDate() === time.getDate() && t('yesterday')) ||
		moment(time).format('L')
	);
}
function setLastMessageTs(instance, ts) {
	if (instance.timeAgoInterval) {
		clearInterval(instance.timeAgoInterval);
	}

	instance.lastMessageTs.set(timeAgo(ts));

	instance.timeAgoInterval = setInterval(() => {
		requestAnimationFrame(() => instance.lastMessageTs.set(timeAgo(ts)));
	}, 60000);
}

Template.sidebarItem.onCreated(function() {
	this.user = RocketChat.models.Users.findOne(Meteor.userId(), { fields: { username: 1 } });

	this.lastMessageTs = new ReactiveVar();
	this.timeAgoInterval;

	// console.log('sidebarItem.onCreated');

	this.autorun(() => {
		const currentData = Template.currentData();

		if (!currentData.lastMessage || RocketChat.getUserPreference(Meteor.userId(), 'sidebarViewMode') !== 'extended') {
			return clearInterval(this.timeAgoInterval);
		}

		if (!currentData.lastMessage._id) {
			return this.renderedMessage = currentData.lastMessage.msg;
		}

		setLastMessageTs(this, currentData.lastMessage.ts);

		if (currentData.lastMessage.t === 'e2e' && currentData.lastMessage.e2e !== 'done') {
			return this.renderedMessage = '******';
		}

		const otherUser = RocketChat.settings.get('UI_Use_Real_Name') ? currentData.lastMessage.u.name || currentData.lastMessage.u.username : currentData.lastMessage.u.username;
		const renderedMessage = renderMessageBody(currentData.lastMessage).replace(/<br\s?\\?>/g, ' ');
		const sender = this.user._id === currentData.lastMessage.u._id ? t('You') : otherUser;

		if (currentData.t === 'd' && Meteor.userId() !== currentData.lastMessage.u._id) {
			this.renderedMessage = currentData.lastMessage.msg === '' ? t('Sent_an_attachment') : renderedMessage;
		} else {
			this.renderedMessage = currentData.lastMessage.msg === '' ? t('user_sent_an_attachment', { user: sender }) : `${ sender }: ${ renderedMessage }`;
		}
	});
});

Template.sidebarItem.events({
	'click [data-id], click .sidebar-item__link'() {
		return menu.close();
	},
	'mouseenter .sidebar-item__link'(e) {
		const element = e.currentTarget;
		const ellipsedElement = element.querySelector('.sidebar-item__ellipsis');
		const isTextEllipsed = ellipsedElement.offsetWidth < ellipsedElement.scrollWidth;

		if (isTextEllipsed) {
			element.setAttribute('title', element.getAttribute('aria-label'));
		} else {
			element.removeAttribute('title');
		}
	},
	'click .sidebar-item__menu'(e) {
		e.preventDefault();

		const canLeave = () => {
			const roomData = Session.get(`roomData${ this.rid }`);

			if (!roomData) { return false; }

			if (roomData.t === 'c' && !RocketChat.authz.hasAtLeastOnePermission('leave-c')) { return false; }
			if (roomData.t === 'p' && !RocketChat.authz.hasAtLeastOnePermission('leave-p')) { return false; }

			return !(((roomData.cl != null) && !roomData.cl) || (['d', 'l'].includes(roomData.t)));
		};

		const canFavorite = RocketChat.settings.get('Favorite_Rooms') && ChatSubscription.find({ rid: this.rid }).count() > 0;
		const isFavorite = () => {
			const sub = ChatSubscription.findOne({ rid: this.rid }, { fields: { f: 1 } });
			if (((sub != null ? sub.f : undefined) != null) && sub.f) {
				return true;
			}
			return false;
		};

		const items = [{
			icon: 'eye-off',
			name: t('Hide_room'),
			type: 'sidebar-item',
			id: 'hide',
		}];

		if (this.alert) {
			items.push({
				icon: 'flag',
				name: t('Mark_as_read'),
				type: 'sidebar-item',
				id: 'read',
			});
		} else {
			items.push({
				icon: 'flag',
				name: t('Mark_as_unread'),
				type: 'sidebar-item',
				id: 'unread',
			});
		}

		if (canFavorite) {
			items.push({
				icon: 'star',
				name: t(isFavorite() ? 'Unfavorite' : 'Favorite'),
				modifier: isFavorite() ? 'star-filled' : 'star',
				type: 'sidebar-item',
				id: 'favorite',
			});
		}

		if (canLeave()) {
			items.push({
				icon: 'sign-out',
				name: t('Leave_room'),
				type: 'sidebar-item',
				id: 'leave',
				modifier: 'error',
			});
		}

		const config = {
			popoverClass: 'sidebar-item',
			columns: [
				{
					groups: [
						{
							items,
						},
					],
				},
			],
			data: {
				template: this.t,
				rid: this.rid,
				name: this.name,
			},
			currentTarget: e.currentTarget,
			offsetHorizontal: -e.currentTarget.clientWidth,
		};

		popover.open(config);
	},
});

Template.sidebarItemIcon.helpers({
	isRoom() {
		return this.rid || this._id;
	},
	status() {
		if (this.t === 'd') {
			return Session.get(`user_${ this.username }_status`) || 'offline';
		}

		if (this.t === 'l') {
			return RocketChat.roomTypes.getUserStatus('l', this.rid) || 'offline';
		}

		return false;
	},
});
