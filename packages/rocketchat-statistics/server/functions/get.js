/* global InstanceStatus, MongoInternals */
import _ from 'underscore';
import os from 'os';
import LivechatVisitors from 'meteor/rocketchat:livechat/server/models/LivechatVisitors';

const wizardFields = [
	'Organization_Type',
	'Organization_Name',
	'Industry',
	'Size',
	'Country',
	'Website',
	'Site_Name',
	'Language',
	'Server_Type',
	'Allow_Marketing_Emails',
];

RocketChat.statistics.get = function _getStatistics() {
	const statistics = {};

	// Setup Wizard
	statistics.wizard = {};
	wizardFields.forEach((field) => {
		const record = RocketChat.models.Settings.findOne(field);
		if (record) {
			const wizardField = field.replace(/_/g, '').replace(field[0], field[0].toLowerCase());
			statistics.wizard[wizardField] = record.value;
		}
	});

	// Version
	statistics.uniqueId = RocketChat.settings.get('uniqueID');
	if (RocketChat.models.Settings.findOne('uniqueID')) {
		statistics.installedAt = RocketChat.models.Settings.findOne('uniqueID').createdAt;
	}

	if (RocketChat.Info) {
		statistics.version = RocketChat.Info.version;
		statistics.tag = RocketChat.Info.tag;
		statistics.branch = RocketChat.Info.branch;
	}

	// User statistics
	statistics.totalUsers = Meteor.users.find().count();
	statistics.activeUsers = Meteor.users.find({ active: true }).count();
	statistics.nonActiveUsers = statistics.totalUsers - statistics.activeUsers;
	statistics.onlineUsers = Meteor.users.find({ statusConnection: 'online' }).count();
	statistics.awayUsers = Meteor.users.find({ statusConnection: 'away' }).count();
	statistics.offlineUsers = statistics.totalUsers - statistics.onlineUsers - statistics.awayUsers;

	// Room statistics
	statistics.totalRooms = RocketChat.models.Rooms.find().count();
	statistics.totalChannels = RocketChat.models.Rooms.findByType('c').count();
	statistics.totalPrivateGroups = RocketChat.models.Rooms.findByType('p').count();
	statistics.totalDirect = RocketChat.models.Rooms.findByType('d').count();
	statistics.totalLivechat = RocketChat.models.Rooms.findByType('l').count();

	// livechat visitors
	statistics.totalLivechatVisitors = LivechatVisitors.find().count();

	// Message statistics
	statistics.totalMessages = RocketChat.models.Messages.find().count();
	statistics.totalChannelMessages = _.reduce(RocketChat.models.Rooms.findByType('c', { fields: { msgs: 1 } }).fetch(), function _countChannelMessages(num, room) { return num + room.msgs; }, 0);
	statistics.totalPrivateGroupMessages = _.reduce(RocketChat.models.Rooms.findByType('p', { fields: { msgs: 1 } }).fetch(), function _countPrivateGroupMessages(num, room) { return num + room.msgs; }, 0);
	statistics.totalDirectMessages = _.reduce(RocketChat.models.Rooms.findByType('d', { fields: { msgs: 1 } }).fetch(), function _countDirectMessages(num, room) { return num + room.msgs; }, 0);
	statistics.totalLivechatMessages = _.reduce(RocketChat.models.Rooms.findByType('l', { fields: { msgs: 1 } }).fetch(), function _countLivechatMessages(num, room) { return num + room.msgs; }, 0);

	statistics.lastLogin = RocketChat.models.Users.getLastLogin();
	statistics.lastMessageSentAt = RocketChat.models.Messages.getLastTimestamp();
	statistics.lastSeenSubscription = RocketChat.models.Subscriptions.getLastSeen();

	statistics.os = {
		type: os.type(),
		platform: os.platform(),
		arch: os.arch(),
		release: os.release(),
		uptime: os.uptime(),
		loadavg: os.loadavg(),
		totalmem: os.totalmem(),
		freemem: os.freemem(),
		cpus: os.cpus(),
	};

	statistics.process = {
		nodeVersion: process.version,
		pid: process.pid,
		uptime: process.uptime(),
	};

	statistics.deploy = {
		method: process.env.DEPLOY_METHOD || 'tar',
		platform: process.env.DEPLOY_PLATFORM || 'selfinstall',
	};

	statistics.migration = RocketChat.Migrations._getControl();
	statistics.instanceCount = InstanceStatus.getCollection().find({ _updatedAt: { $gt: new Date(Date.now() - process.uptime() * 1000 - 2000) } }).count();

	if (MongoInternals.defaultRemoteCollectionDriver().mongo._oplogHandle && MongoInternals.defaultRemoteCollectionDriver().mongo._oplogHandle.onOplogEntry && RocketChat.settings.get('Force_Disable_OpLog_For_Cache') !== true) {
		statistics.oplogEnabled = true;
	}

	return statistics;
};
