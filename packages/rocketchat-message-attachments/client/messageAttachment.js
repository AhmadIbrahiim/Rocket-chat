import { DateFormat } from 'meteor/rocketchat:lib';
import { fixCordova } from 'meteor/rocketchat:lazy-load';
const colors = {
	good: '#35AC19',
	warning: '#FCB316',
	danger: '#D30230',
};

/* globals renderMessageBody*/
Template.messageAttachment.helpers({
	fixCordova,
	parsedText() {
		return renderMessageBody({
			msg: this.text,
		});
	},
	markdownInPretext() {
		return this.mrkdwn_in && this.mrkdwn_in.includes('pretext');
	},
	parsedPretext() {
		return renderMessageBody({
			msg: this.pretext,
		});
	},
	loadImage() {
		if (this.downloadImages !== true) {
			const user = RocketChat.models.Users.findOne({ _id: Meteor.userId() }, { fields: { 'settings.autoImageLoad' : 1 } });
			if (RocketChat.getUserPreference(user, 'autoImageLoad') === false) {
				return false;
			}
			if (Meteor.Device.isPhone() && RocketChat.getUserPreference(user, 'saveMobileBandwidth') !== true) {
				return false;
			}
		}
		return true;
	},
	getImageHeight(height = 200) {
		return height;
	},
	color() {
		return colors[this.color] || this.color;
	},
	collapsed() {
		if (this.collapsed != null) {
			return this.collapsed;
		}
		return false;
	},
	mediaCollapsed() {
		if (this.collapsed != null) {
			return this.collapsed;
		} else {
			const user = Meteor.user();
			return RocketChat.getUserPreference(user, 'collapseMediaByDefault') === true;
		}
	},
	time() {
		const messageDate = new Date(this.ts);
		const today = new Date();
		if (messageDate.toDateString() === today.toDateString()) {
			return DateFormat.formatTime(this.ts);
		}
		return DateFormat.formatDateAndTime(this.ts);
	},
	injectIndex(data, previousIndex, index) {
		data.index = `${ previousIndex }.attachments.${ index }`;
	},

	isFile() {
		return this.type === 'file';
	},
});
