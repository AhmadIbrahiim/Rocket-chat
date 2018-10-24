/* globals alerts, modal */

import './stylesheets/e2e';

import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { EJSON } from 'meteor/ejson';

import { FlowRouter } from 'meteor/kadira:flow-router';
import { RocketChat, call } from 'meteor/rocketchat:lib';
import { TAPi18n } from 'meteor/tap:i18n';
import { E2ERoom } from './rocketchat.e2e.room';
import {
	Deferred,
	toString,
	toArrayBuffer,
	joinVectorAndEcryptedData,
	splitVectorAndEcryptedData,
	encryptAES,
	decryptAES,
	generateRSAKey,
	exportJWKKey,
	importRSAKey,
	importRawKey,
	deriveKey,
} from './helper';

let failedToDecodeKey = false;

class E2E {
	constructor() {
		this.started = false;
		this.enabled = new ReactiveVar(false);
		this._ready = new ReactiveVar(false);
		this.instancesByRoomId = {};
		this.readyPromise = new Deferred();
		this.readyPromise.then(() => {
			this._ready.set(true);
		});
	}

	isEnabled() {
		return this.enabled.get();
	}

	isReady() {
		return this.enabled.get() && this._ready.get();
	}

	async ready() {
		return this.readyPromise;
	}

	async getInstanceByRoomId(roomId) {
		if (!this.enabled.get()) {
			return;
		}

		const room = RocketChat.models.Rooms.findOne({
			_id: roomId,
		});

		if (room.encrypted !== true) {
			return;
		}

		if (!this.instancesByRoomId[roomId]) {
			const subscription = RocketChat.models.Subscriptions.findOne({
				rid: roomId,
			});

			if (!subscription || (subscription.t !== 'd' && subscription.t !== 'p')) {
				return;
			}

			this.instancesByRoomId[roomId] = new E2ERoom(Meteor.userId(), roomId, subscription.t);
		}

		const e2eRoom = this.instancesByRoomId[roomId];

		await this.ready();

		if (e2eRoom) {
			await e2eRoom.handshake();
			return e2eRoom;
		}
	}

	async startClient() {
		if (this.started) {
			return;
		}

		this.started = true;
		let public_key = localStorage.getItem('public_key');
		let private_key = localStorage.getItem('private_key');

		await this.loadKeysFromDB();

		if (!public_key && this.db_public_key) {
			public_key = this.db_public_key;
		}

		if (!private_key && this.db_private_key) {
			try {
				private_key = await this.decodePrivateKey(this.db_private_key);
			} catch (error) {
				this.started = false;
				failedToDecodeKey = true;
				alerts.open({
					title: TAPi18n.__('Wasn\'t possible to decode your encryption key to be imported.'),
					html: '<div>Your encryption password seems wrong. Click here to try again.</div>',
					modifiers: ['large', 'danger'],
					closable: true,
					icon: 'key',
					action: () => {
						this.startClient();
						alerts.close();
					},
				});
				return;
			}
		}

		if (public_key && private_key) {
			await this.loadKeys({ public_key, private_key });
		} else {
			await this.createAndLoadKeys();
		}

		// TODO: Split in 2 methods to persist keys
		if (!this.db_public_key || !this.db_private_key) {
			await call('e2e.setUserPublicAndPivateKeys', {
				public_key: localStorage.getItem('public_key'),
				private_key: await this.encodePrivateKey(localStorage.getItem('private_key'), this.createRandomPassword()),
			});
		}

		const randomPassword = localStorage.getItem('e2e.randomPassword');
		if (randomPassword) {
			const passwordRevealText = TAPi18n.__('E2E_password_reveal_text', {
				postProcess: 'sprintf',
				sprintf: [randomPassword],
			});

			alerts.open({
				title: TAPi18n.__('Save_your_encryption_password'),
				html: TAPi18n.__('Click_here_to_view_and_copy_your_password'),
				modifiers: ['large'],
				closable: false,
				icon: 'key',
				action() {
					modal.open({
						title: TAPi18n.__('Save_your_encryption_password'),
						html: true,
						text: `<div>${ passwordRevealText }</div>`,
						showConfirmButton: true,
						showCancelButton: true,
						confirmButtonText: TAPi18n.__('I_saved_my_password_close_this_message'),
						cancelButtonText: TAPi18n.__('I_ll_do_it_later'),
					}, (confirm) => {
						if (!confirm) {
							return;
						}
						localStorage.removeItem('e2e.randomPassword');
						alerts.close();
					});
				},
			});
		}

		this.readyPromise.resolve();

		this.setupListeners();

		this.decryptPendingMessages();
		this.decryptPendingSubscriptions();
	}

	setupListeners() {
		RocketChat.Notifications.onUser('e2ekeyRequest', async(roomId, keyId) => {
			const e2eRoom = await this.getInstanceByRoomId(roomId);
			if (!e2eRoom) {
				return;
			}

			e2eRoom.provideKeyToUser(keyId);
		});

		RocketChat.models.Subscriptions.after.update((userId, doc) => {
			this.decryptSubscription(doc);
		});

		RocketChat.models.Subscriptions.after.insert((userId, doc) => {
			this.decryptSubscription(doc);
		});

		RocketChat.models.Messages.after.update((userId, doc) => {
			this.decryptMessage(doc);
		});

		RocketChat.models.Messages.after.insert((userId, doc) => {
			this.decryptMessage(doc);
		});
	}

	async changePassword(newPassword) {
		await call('e2e.setUserPublicAndPivateKeys', {
			public_key: localStorage.getItem('public_key'),
			private_key: await this.encodePrivateKey(localStorage.getItem('private_key'), newPassword),
		});

		if (localStorage.getItem('e2e.randomPassword')) {
			localStorage.setItem('e2e.randomPassword', newPassword);
		}
	}

	async loadKeysFromDB() {
		try {
			const { public_key, private_key } = await call('e2e.fetchMyKeys');
			this.db_public_key = public_key;
			this.db_private_key = private_key;
		} catch (error) {
			return console.error('E2E -> Error fetching RSA keys: ', error);
		}
	}

	async loadKeys({ public_key, private_key }) {
		localStorage.setItem('public_key', public_key);

		try {
			this.privateKey = await importRSAKey(EJSON.parse(private_key), ['decrypt']);

			localStorage.setItem('private_key', private_key);
		} catch (error) {
			return console.error('E2E -> Error importing private key: ', error);
		}
	}

	async createAndLoadKeys() {
		// Could not obtain public-private keypair from server.
		let key;
		try {
			key = await generateRSAKey();
			this.privateKey = key.privateKey;
		} catch (error) {
			return console.error('E2E -> Error generating key: ', error);
		}

		try {
			const publicKey = await exportJWKKey(key.publicKey);

			localStorage.setItem('public_key', JSON.stringify(publicKey));
		} catch (error) {
			return console.error('E2E -> Error exporting public key: ', error);
		}

		try {
			const privateKey = await exportJWKKey(key.privateKey);

			localStorage.setItem('private_key', JSON.stringify(privateKey));
		} catch (error) {
			return console.error('E2E -> Error exporting private key: ', error);
		}
	}

	createRandomPassword() {
		const randomPassword = `${ Random.id(3) }-${ Random.id(3) }-${ Random.id(3) }`.toLowerCase();
		localStorage.setItem('e2e.randomPassword', randomPassword);
		return randomPassword;
	}

	async encodePrivateKey(private_key, password) {
		const masterKey = await this.getMasterKey(password);

		const vector = crypto.getRandomValues(new Uint8Array(16));
		try {
			const encodedPrivateKey = await encryptAES(vector, masterKey, toArrayBuffer(private_key));

			return EJSON.stringify(joinVectorAndEcryptedData(vector, encodedPrivateKey));
		} catch (error) {
			return console.error('E2E -> Error encrypting encodedPrivateKey: ', error);
		}
	}

	async getMasterKey(password) {
		if (password == null) {
			alert('You should provide a password');
		}

		// First, create a PBKDF2 "key" containing the password
		let baseKey;
		try {
			baseKey = await importRawKey(toArrayBuffer(password));
		} catch (error) {
			return console.error('E2E -> Error creating a key based on user password: ', error);
		}

		// Derive a key from the password
		try {
			return await deriveKey(toArrayBuffer(Meteor.userId()), baseKey);
		} catch (error) {
			return console.error('E2E -> Error deriving baseKey: ', error);
		}
	}

	async requestPassword() {
		return new Promise((resolve) => {
			let showAlert;

			const showModal = () => {
				modal.open({
					title: TAPi18n.__('Enter_E2E_password_to_decode_your_key'),
					type: 'input',
					inputType: 'text',
					html: true,
					text: `<div>${ TAPi18n.__('E2E_password_request_text') }</div>`,
					showConfirmButton: true,
					showCancelButton: true,
					confirmButtonText: TAPi18n.__('Decode_Key'),
					cancelButtonText: TAPi18n.__('I_ll_do_it_later'),
				}, (password) => {
					if (password) {
						alerts.close();
						resolve(password);
					}
				}, () => {
					failedToDecodeKey = false;
					showAlert();
				});
			};

			showAlert = () => {
				alerts.open({
					title: TAPi18n.__('Enter_your_E2E_password'),
					html: TAPi18n.__('Click_here_to_enter_your_encryption_password'),
					modifiers: ['large'],
					closable: false,
					icon: 'key',
					action() {
						showModal();
					},
				});
			};

			if (failedToDecodeKey) {
				showModal();
			} else {
				showAlert();
			}
		});
	}

	async decodePrivateKey(private_key) {
		const password = await this.requestPassword();

		const masterKey = await this.getMasterKey(password);

		const [vector, cipherText] = splitVectorAndEcryptedData(EJSON.parse(private_key));

		try {
			const privKey = await decryptAES(vector, masterKey, cipherText);
			return toString(privKey);
		} catch (error) {
			throw new Error('E2E -> Error decrypting private key');
		}
	}

	async decryptMessage(message) {
		if (!this.isEnabled()) {
			return;
		}

		if (message.t !== 'e2e' || message.e2e === 'done') {
			return;
		}

		const e2eRoom = await this.getInstanceByRoomId(message.rid);

		if (!e2eRoom) {
			return;
		}

		const data = await e2eRoom.decrypt(message.msg);
		if (!data) {
			return;
		}

		RocketChat.models.Messages.direct.update({ _id: message._id }, {
			$set: {
				msg: data.text,
				e2e: 'done',
			},
		});
	}

	async decryptPendingMessages() {
		if (!this.isEnabled()) {
			return;
		}

		return await RocketChat.models.Messages.find({ t: 'e2e', e2e: 'pending' }).forEach(async(item) => {
			await this.decryptMessage(item);
		});
	}

	async decryptSubscription(subscription) {
		if (!this.isEnabled()) {
			return;
		}

		if (!subscription.lastMessage || subscription.lastMessage.t !== 'e2e' || subscription.lastMessage.e2e === 'done') {
			return;
		}

		const e2eRoom = await this.getInstanceByRoomId(subscription.rid);

		if (!e2eRoom) {
			return;
		}

		const data = await e2eRoom.decrypt(subscription.lastMessage.msg);
		if (!data) {
			return;
		}

		RocketChat.models.Subscriptions.direct.update({
			_id: subscription._id,
		}, {
			$set: {
				'lastMessage.msg': data.text,
				'lastMessage.e2e': 'done',
			},
		});
	}

	async decryptPendingSubscriptions() {
		RocketChat.models.Subscriptions.find({
			'lastMessage.t': 'e2e',
			'lastMessage.e2e': {
				$ne: 'done',
			},
		}).forEach(this.decryptSubscription.bind(this));
	}
}

export const e2e = new E2E();

Meteor.startup(function() {
	Tracker.autorun(function() {
		if (Meteor.userId()) {
			const adminEmbedded = RocketChat.Layout.isEmbedded() && FlowRouter.current().path.startsWith('/admin');

			if (!adminEmbedded && RocketChat.settings.get('E2E_Enable') && window.crypto) {
				e2e.startClient();
				e2e.enabled.set(true);
			} else {
				e2e.enabled.set(false);
			}
		}
	});

	// Encrypt messages before sending
	RocketChat.promises.add('onClientBeforeSendMessage', async function(message) {
		if (!message.rid) {
			return Promise.resolve(message);
		}

		const e2eRoom = await e2e.getInstanceByRoomId(message.rid);
		if (!e2eRoom) {
			return Promise.resolve(message);
		}

		// Should encrypt this message.
		return e2eRoom
			.encrypt(message)
			.then((msg) => {
				message.msg = msg;
				message.t = 'e2e';
				message.e2e = 'pending';
				return message;
			});
	}, RocketChat.promises.priority.HIGH);
});
