import _ from 'underscore';
import './lazyloadImage';
export const fixCordova = function(url) {
	if (url && url.indexOf('data:image') === 0) {
		return url;
	}
	if (Meteor.isCordova && (url && url[0] === '/')) {
		url = Meteor.absoluteUrl().replace(/\/$/, '') + url;
		const query = `rc_uid=${ Meteor.userId() }&rc_token=${ Meteor._localStorage.getItem(
			'Meteor.loginToken'
		) }`;
		if (url.indexOf('?') === -1) {
			url = `${ url }?${ query }`;
		} else {
			url = `${ url }&${ query }`;
		}
	}
	if (Meteor.settings.public.sandstorm || url.match(/^(https?:)?\/\//i)) {
		return url;
	} else if (navigator.userAgent.indexOf('Electron') > -1) {
		return __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + url;
	} else {
		return Meteor.absoluteUrl().replace(/\/$/, '') + url;
	}
};

const getEl = (el, instance) => (instance && instance.firstNode) || el;

const loadImage = (el, instance) => {
	const element = getEl(el, instance);
	const img = new Image();
	const src = element.getAttribute('data-src');
	img.onload = function() {
		if (instance) {
			instance.loaded.set(true);
		} else {
			element.className = element.className.replace('lazy-img', '');
			element.src = src;
		}
		element.removeAttribute('data-src');
	};
	img.src = fixCordova(src);
};

const isVisible = (el, instance) => {
	requestAnimationFrame(() => {
		const rect = getEl(el, instance).getBoundingClientRect();
		if (rect.top >= -100 && rect.left >= 0 && rect.top <= (window.innerHeight || document.documentElement.clientHeight)) {
			return loadImage(el, instance);
		}
	});

};

window.addEventListener('resize', window.lazyloadtick);

export const lazyloadtick = _.debounce(() => {
	[...document.querySelectorAll('.lazy-img[data-src]')].forEach((el) =>
		isVisible(el, Blaze.getView(el)._templateInstance)
	);
}, 300);

window.lazyloadtick = lazyloadtick;

export const addImage = (instance) => isVisible(instance.firstNode, instance);
