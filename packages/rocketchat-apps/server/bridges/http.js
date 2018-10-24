export class AppHttpBridge {
	async call(info) {
		if (!info.request.content && typeof info.request.data === 'object') {
			info.request.content = JSON.stringify(info.request.data);
		}

		console.log(`The App ${ info.appId } is requesting from the outter webs:`, info);

		try {
			return HTTP.call(info.method, info.url, info.request);
		} catch (e) {
			return e.response;
		}
	}
}
