/* globals UploadFS */

import _ from 'underscore';
import './AmazonS3.js';
import './FileSystem.js';
import './GoogleStorage.js';
import './GridFS.js';
import './Webdav.js';
import './Slingshot_DEPRECATED.js';

const configStore = _.debounce(() => {
	const store = RocketChat.settings.get('FileUpload_Storage_Type');

	if (store) {
		console.log('Setting default file store to', store);
		UploadFS.getStores().Avatars = UploadFS.getStore(`${ store }:Avatars`);
		UploadFS.getStores().Uploads = UploadFS.getStore(`${ store }:Uploads`);
		UploadFS.getStores().UserDataFiles = UploadFS.getStore(`${ store }:UserDataFiles`);
	}
}, 1000);

RocketChat.settings.get(/^FileUpload_/, configStore);
