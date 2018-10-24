import { findRoom, findGuest, settings, online } from '../lib/livechat';

RocketChat.API.v1.addRoute('livechat/config', {
	get() {
		try {
			check(this.queryParams, {
				token: Match.Maybe(String),
			});

			const config = settings();
			if (!config.enabled) {
				return RocketChat.API.v1.success({ config: { enabled: false } });
			}

			const { status } = online();

			let guest;
			let room;
			let agent;

			if (this.queryParams.token) {
				guest = findGuest(this.queryParams.token);
				room = findRoom(this.queryParams.token);
				agent = room && room.servedBy && RocketChat.models.Users.getAgentInfo(room.servedBy._id);
			}

			Object.assign(config, { online: status, guest, room, agent });

			return RocketChat.API.v1.success({ config });
		} catch (e) {
			return RocketChat.API.v1.failure(e);
		}
	},
});
