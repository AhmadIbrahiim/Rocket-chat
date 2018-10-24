import './lazyloadImage.html';
import { addImage, fixCordova } from './';

const emptyImageEncoded =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8+/u3PQAJJAM0dIyWdgAAAABJRU5ErkJggg==';

Template.lazyloadImage.helpers({
	class() {
		const loaded = Template.instance().loaded.get();
		return `${ this.class } ${ loaded ? '' : 'lazy-img' }`;
	},

	srcUrl() {
		return this.src && fixCordova(this.src);
	},

	lazySrcUrl() {
		const { preview, placeholder, src } = this;

		if (Template.instance().loaded.get() || (!preview && !placeholder)) {
			return fixCordova(src);
		}

		return `data:image/png;base64,${ preview || emptyImageEncoded }`;
	},
});

Template.lazyloadImage.onCreated(function() {
	this.loaded = new ReactiveVar(false);
});

Template.lazyloadImage.onRendered(function() {
	addImage(this);
});
