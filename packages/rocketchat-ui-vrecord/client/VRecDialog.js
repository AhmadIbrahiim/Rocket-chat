import _ from 'underscore';

export const VRecDialog = new class {
	constructor() {
		this.opened = false;
		this.initiated = false;
		this.width = 400;
		this.height = 290;
	}

	init() {
		if (this.initiated) {
			return;
		}

		this.initiated = true;
		return Blaze.render(Template.vrecDialog, document.body);
	}

	open(source, options = {}) {
		if (!this.initiated) {
			this.init();
		}

		this.source = source;
		const dialog = $('.vrec-dialog');
		this.setPosition(dialog, source, options.anchor);
		dialog.addClass('show');
		this.opened = true;

		return this.initializeCamera();
	}

	close() {
		$('.vrec-dialog').removeClass('show');
		this.opened = false;
		$(window).off('resize', this.remove);
		if (this.video != null) {
			return VideoRecorder.stop();
		}
	}

	setPosition(dialog, source, anchor = 'left') {

		const _set = () => {
			const sourcePos = $(source).offset();
			let top = sourcePos.top - this.height - 5;

			if (top < 0) {
				top = 10;
			}
			if (anchor === 'left') {
				let right = window.innerWidth - (sourcePos.left + source.offsetWidth - 25);
				if (right < 0) {
					right = 10;
				}
				return dialog.css({ top: `${ top }px`, right: `${ right }px` });
			} else {
				let left = (sourcePos.left - this.width) + 100;
				if (left < 0) {
					left = 10;
				}
				return dialog.css({ top: `${ top }px`, left: `${ left }px` });
			}
		};

		const set = _.debounce(_set, 2000);
		_set();
		this.remove = set;
		$(window).on('resize', set);

	}

	initializeCamera() {
		this.video = $('.vrec-dialog video').get('0');
		if (!this.video) {
			return;
		}
		return VideoRecorder.start(this.video);
	}
};
