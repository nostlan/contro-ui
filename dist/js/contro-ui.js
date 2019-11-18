if (!log) {
	const log = console.log;
}
const {
	Mouse,
	Keyboard,
	Gamepad,
	or,
	and
} = require('contro');
let gamepad = new Gamepad();

if (!jQuery) {
	console.error('contro-ui requires jquery');
	return;
}
// https://stackoverflow.com/questions/4080497/how-can-i-listen-for-a-click-and-hold-in-jquery
(function($) {
	function startTrigger(e) {
		var $elem = $(this);
		$elem.data('mouseheld_timeout', setTimeout(function() {
			$elem.trigger('mouseheld');
		}, e.data));
	}

	function stopTrigger() {
		var $elem = $(this);
		clearTimeout($elem.data('mouseheld_timeout'));
	}

	var mouseheld = $.event.special.mouseheld = {
		setup: function(data) {
			// the first binding of a mouseheld event on an element will trigger this
			// lets bind our event handlers
			var $this = $(this);
			$this.bind('mousedown', +data || mouseheld.time, startTrigger);
			$this.bind('mouseleave mouseup', stopTrigger);
		},
		teardown: function() {
			var $this = $(this);
			$this.unbind('mousedown', startTrigger);
			$this.unbind('mouseleave mouseup', stopTrigger);
		},
		time: 750 // default to 750ms
	};
})(jQuery);

let gamepadConnected = false;
let btnNames = [
	'a', 'b', 'x', 'y',
	'up', 'down', 'left', 'right',
	'view', 'start'
];
let btns = {};
for (let i of btnNames) {
	btns[i] = gamepad.button(i);
}
let btnStates = {};
let stickNue = {
	x: true,
	y: true
};
let cuis = {};
let mouse;
let mouseWheelDeltaNSS;
let pos = 0;
let uiPrevStates = [];
let uiAfterError = '';
let $cur;
for (let i of btnNames) {
	btnStates[i] = false;
}

let map = {};
const remappingProfiles = {
	Xbox_PS_Adaptive: {
		map: {
			a: 'b',
			b: 'a',
			x: 'y',
			y: 'x'
		},
		disable: 'ps|xbox|pc|mame'
	},
	Nintendo_Adaptive: {
		map: {
			a: 'b',
			b: 'a',
			x: 'y',
			y: 'x'
		},
		enable: 'ps|xbox|pc|mame'
	},
	Xbox_PS_Consistent: {
		map: {
			a: 'b',
			b: 'a',
			x: 'y',
			y: 'x'
		}
	},
	Nintendo_Consistent: {
		map: {
			a: 'b',
			b: 'a',
			x: 'y',
			y: 'x'
		}
	},
	Xbox_PS_None: {
		map: {}
	},
	Nintendo_None: {
		map: {}
	}
};
let gamepadPrefs = {
	default: {
		profile: 'Xbox_PS_Adaptive',
		map: {}
	}
};
let normalize = {};
let opt = {
	v: true
};

class CUI {
	constructor() {
		this.opt = {};
		this.uiPrev = '';
		this.ui = '';
		this.uiSub = '';
		this.gamepadType = 'default';
		this.er = this.error;
		this.err = this.error;
	}

	async onChange() {
		log('override this method: onChange');
	}
	async afterChange() {
		log('override this method: afterChange');
	}
	async onResize() {
		log('override this method: onResize');
	}
	async onAction() {
		log('override this method: onAction');
	}
	async onHeldAction() {
		log('override this method: onHeldAction');
	}

	mapButtons(system, gPrefs, norm) {
		system = system || 'PC';
		gamepadPrefs = gPrefs || gamepadPrefs;
		normalize = norm || normalize;

		let pad = gamepadPrefs[this.gamepadType];
		let prof = remappingProfiles[pad.profile];
		let enable;
		if (prof.enable) {
			enable = new RegExp(`(${prof.enable})`, 'i');
		}
		let disable;
		if (prof.disable) {
			disable = new RegExp(`(${prof.disable})`, 'i');
		}
		// Xbox/PS Adaptive profile usage example:

		// User is currently browsing their Nintendo Switch library
		// Xbox One controller is mapped to
		// Nintendo Switch controller button layout
		//  Y B  ->  X A
		// X A  ->  Y B

		// When browsing Xbox 360 games no mapping occurs
		//  Y B  ->  Y B
		// X A  ->  X A

		// When browsing PS3 games no mapping occurs either
		// since A(Xbox One) auto maps to X(PS3)
		//  Y B  ->  △ ○
		// X A  ->  □ X
		if ((!enable || enable.test(system)) && (!disable || !disable.test(system))) {
			// log('controller remapping enabled for ' + system);
			map = {};
			for (let i in prof.map) {
				map[i] = pad.map[prof.map[i]] || prof.map[i];
			}
		} else {
			// log('no controller remapping for ' + system);
			map = {};
		}

		// normalize X and Y to nintendo physical layout
		// this will make the physical layout of an app consistent
		// and doAction choices consistent for certain buttons
		if (normalize &&
			((normalize.disable &&
					!(new RegExp(`(${normalize.disable})`, 'i')).test(pad.profile)) ||
				(normalize.enable &&
					(new RegExp(`(${normalize.enable})`, 'i')).test(pad.profile))
			)) {
			for (let i in normalize.map) {
				map[i] = pad.map[normalize.map[i]] || normalize.map[i];
			}
		}
	}

	async doAction(act) {
		if (act == 'error-okay' || act == 'back') {
			if (uiAfterError) {
				this.change(uiAfterError);
				return;
			}
			for (let i = uiPrevStates.length - 1; i >= 0; i--) {
				if (this.ui != uiPrevStates[i]) {
					this.change(uiPrevStates[i]);
					return;
				}
			}
		} else {
			if (this.onAction) {
				await this.onAction(act, btnNames.includes(act));
			}
		}
	}

	async doHeldAction(act, timeHeld) {
		if (this.onHeldAction) {
			await this.onHeldAction(act, btnNames.includes(act), timeHeld);
		}
	}

	async resize(adjust, state) {
		state = state || this.ui;
		if ((/menu/gi).test(state)) {
			let $menu = $('#' + state);
			$menu.css('margin-top',
				$(window).height() * .5 - $menu.outerHeight() * .5);
		}
		if (this.onResize) {
			await this.onResize(adjust);
		}
	}

	getCur(state) {
		return (cuis[state || this.ui] || {}).$cur || $('');
	}

	setMouse(mouseInfo, delta) {
		mouse = mouseInfo;
		mouseWheelDeltaNSS = delta;
	}

	scrollTo(position, time) {
		if (isNaN(position)) {
			log(`pos can't be: ` + position);
			return;
		}
		pos = position;
		time = ((time == undefined) ? 2000 : time);
		if (time == 0) time = 100;
		let options = {
			duration: time,
			fill: 'forwards',
			easing: (time == 100) ? 'ease-out' : 'ease-in-out'
		};
		let $reels = $('.reel');
		for (let i = 0; i < $reels.length; i++) {
			let $reel = $reels.eq(i);
			let attr = ($reel.hasClass('reverse')) ? 'bottom' : 'top';
			$reel[0].animate({
				[attr]: [$reel.css(attr), -pos + 'px']
			}, options);
		}
	}

	scrollToCursor(time, minDistance) {
		if ((/menu/gi).test(this.ui)) return;
		if (this.opt.v) log($cur);
		let $reel = $cur.parent();
		let position = 0;
		for (let i = 0; i < $cur.index(); i++) {
			position += $reel.children().eq(i).height();
		}
		position += $cur.height() * .5;
		if ($reel.hasClass('reverse')) {
			position += $(window).height() * .5;
			position = $reel.height() - position;
		} else {
			position -= $(window).height() * .5;
		}
		let scrollDist = Math.abs(pos - position);
		if (minDistance == null) minDistance = .4;
		if (scrollDist < $(window).height() * minDistance) return;
		let sTime;
		if (time > -1) {
			sTime = time || 1;
		} else {
			sTime = ($(window).height() * 2 - $cur.height()) / 5;
		}
		if (time == undefined && scrollDist > $cur.height() * 1.1) {
			sTime += scrollDist;
		}
		this.scrollTo(position, sTime);
	}

	removeCursor() {
		if (!$cur) {
			return;
		}
		$cur.removeClass('cursor');
	}

	makeCursor($cursor, state) {
		if (!$cursor) return;
		this.removeCursor();
		$cur = $cursor;
		$cur.addClass('cursor');
		if (!cuis[state || this.ui]) cuis[state || this.ui] = {};
		cuis[state || this.ui].$cur = $cur;
	}

	addView(state, options) {
		cuis[state] = options;
		this.addListeners('#' + state);
	}

	removeView(state) {
		$('#' + state).empty();
		if ((/main/i).test(state)) {
			this.uiPrev = null;
		}
	}

	/**
	 * Summary.
	 * @param {String}  state          state of the UI.
	 * @param {String}  subState       subState of the UI.
	 * @param {Object}  [options={}]
	 * @param {Boolean} [options.keepBackground=false]
	 * @return void
	 */
	async change(state, subState, options) {
		options = options || {};
		if (state == this.ui) {
			this.doAction('b');
			return;
		}
		$('#' + state).show();
		if (this.onChange) {
			await this.onChange(state, subState || this.uiSub, gamepadConnected);
		}
		if ((/main/gi).test(state)) {
			if (this.ui == 'errMenu' || (!(/select/gi).test(this.ui) && !(/menu/gi).test(this.ui))) {
				let $mid = $('#' + state + ' .reel.r0').children();
				$mid = $mid.eq(Math.round($mid.length * .5) - 1);
				this.makeCursor($mid, state);
			} else {
				this.makeCursor(cuis[state].$cur, state);
			}
			this.scrollToCursor(0, 0);
		} else if ((/select/gi).test(state)) {
			this.makeCursor(cuis[this.ui].$cur, state);
		} else {
			let $temp;
			$temp = $(`#${state}.row-y`).eq(0).find('.uie').eq(0);
			if (!$temp.length) {
				$temp = $(`#${state}.row-x`).eq(0).find('.uie').eq(0);
			}
			if (!$temp.length) {
				$temp = $(`#${state} .row-y`).eq(0).find('.uie').eq(0);
			}
			if (!$temp.length) {
				$temp = $(`#${state} .row-x`).eq(0).find('.uie').eq(0);
			}
			this.makeCursor($temp, state);
		}
		$('body').removeClass(this.ui);
		$('body').addClass(state);
		if (subState) {
			$('body').removeClass(this.uiSub);
			$('body').addClass(subState);
		}
		this.resize(true, state);
		if (this.ui && !options.b && !options.keepBackground &&
			!(/select/gi).test(state) && !(/menu/gi).test(state) || (/menu/gi).test(this.ui)) {
			// $('.cui:not(.main)').hide();
			$('#' + this.ui).hide();
			$('.' + this.ui).hide();
		} else {
			// log('keeping prev ui in background');
		}
		if (this.ui) uiPrevStates.push(this.ui);
		this.uiPrev = this.ui;
		this.ui = state;
		this.uiSub = subState || this.uiSub;
		if (this.opt.v) {
			log(this.uiPrev + ' to ' + state);
		}
		if (this.afterChange) {
			await this.afterChange();
		}
	}

	addListeners(id) {
		if (!id) id = '';
		var _this = this;
		$(id + ' .uie').click(function() {
			let classes = $(this).attr('class').split(' ');
			if (classes.includes('uie-disabled')) return;
			_this.makeCursor($(this));
			_this.buttonPressed('a');
		});
		$(id + ' .uie').hover(function() {
			if (!cuis[_this.ui].hoverCurDisabled &&
				$(this).parents('#' + _this.ui).length) {
				_this.makeCursor($(this));
			}
		});
	}

	async move(direction) {
		let $rowX = $cur.closest('.row-x');
		let $rowY = $cur.closest('.row-y');
		let curX, curY;
		let inVerticalRow = $rowX.has($rowY.get(0)).length || !$rowX.length;
		if (inVerticalRow) {
			curX = $rowY.index(); // index of rowY in rowX
			curY = $cur.index();
		} else {
			curX = $cur.index();
			curY = $rowX.index(); // index of rowX in rowY
		}
		let x = curX;
		let y = curY;
		switch (direction.toLowerCase()) {
			case 'up':
				y -= 1;
				break;
			case 'down':
				y += 1;
				break;
			case 'left':
				x -= 1;
				break;
			case 'right':
				x += 1;
				break;
			default:

		}
		let ret = {
			$cur: $cur,
			$rowX: $rowX,
			$rowY: $rowY
		};
		if (x < 0 || y < 0) {
			return;
		}
		if (inVerticalRow) {
			if (x == curX) {
				ret.$cur = $rowY.children().eq(y);
			} else {
				if (!$rowX.length) return;
				ret.$rowY = $rowX.children().eq(x);
				if (!ret.$rowY.length) return;
				let curRect = $cur.get(0).getBoundingClientRect();
				let rowYLength = ret.$rowY.children().length;
				if (y >= rowYLength) y = Math.floor(rowYLength / 2);
				while (y < rowYLength && y >= 0) {
					ret.$cur = ret.$rowY.children().eq(y);
					let elmRect = ret.$cur.get(0).getBoundingClientRect();
					let diff = curRect.top - elmRect.top;
					let halfHeight = Math.max($cur.height(), ret.$cur.height()) * .6;
					if (halfHeight < diff) {
						y++;
					} else if (-halfHeight > diff) {
						y--;
					} else {
						break;
					}
				}
			}
		} else {
			// todo
		}
		if (!ret.$cur.length) return;
		this.makeCursor(ret.$cur);
		this.scrollToCursor();
		return true;
	}

	async buttonPressed(btn) {
		if (typeof btn == 'string') {
			btn = {
				label: btn
			};
		}
		let lbl = btn.label.toLowerCase();
		if (lbl == 'view') {
			lbl = 'select';
		}
		switch (lbl) {
			case 'up':
			case 'down':
			case 'left':
			case 'right':
				this.move(lbl);
				break;
			case 'a':
				await this.doAction($cur.attr('name') || 'a');
				break;
			case 'b':
			case 'x':
			case 'y':
			case 'select':
			case 'start':
				await this.doAction(lbl);
				break;
			default:
				if (this.opt.v) log('button does nothing');
				return;
		}
	}

	async buttonHeld(btn, timeHeld) {
		if (typeof btn == 'string') {
			btn = {
				label: btn
			};
		}
		let lbl = btn.label.toLowerCase();
		if (lbl == 'view') {
			lbl = 'select';
		}
		switch (lbl) {
			case 'a':
				await this.doHeldAction($cur.attr('name') || 'a', timeHeld);
				break;
			case 'up':
			case 'down':
			case 'left':
			case 'right':
			case 'b':
			case 'x':
			case 'y':
			case 'select':
			case 'start':
				await this.doHeldAction(lbl, timeHeld);
				break;
			default:
				if (this.opt.v) log('button does nothing');
				return;
		}
	}

	async parseBtns(btns) {
		for (let i in btns) {
			let btn = btns[i];
			// incomplete maps are okay
			// no one to one mapping necessary
			i = map[i] || i;

			let query;
			if (typeof btn == 'boolean') {
				query = btn;
			} else {
				query = btn.query();
			}
			// if button is not pressed, query is false and unchanged
			if (!btnStates[i] && !query) continue;
			// if button press ended query is false
			if (!query) {
				// log(i + ' button press end');
				btnStates[i] = 0;
				continue;
			}
			// if button is held, query is true and unchanged
			if (btnStates[i] && query) {
				btnStates[i] += 1;
				await this.buttonHeld(i, btnStates[i] * 16);
				continue;
			}
			// save button state change
			btnStates[i] += 1;
			// if button press just started, query is true
			if (this.opt.v) log(i + ' button press start');
			await this.buttonPressed(i);
		}
	}

	sticks(stks) {
		let didMove = false;
		let vect = stks.left;
		if (vect.y < -.5) {
			if (stickNue.y) this.move('up');
			stickNue.y = false;
		}
		if (vect.y > .5) {
			if (stickNue.y) this.move('down');
			stickNue.y = false;
		}
		if (vect.x < -.5) {
			if (stickNue.x) this.move('left');
			stickNue.x = false;
		}
		if (vect.x > .5) {
			if (stickNue.x) this.move('right');
			stickNue.x = false;
		}
		if (vect.x < .5 &&
			vect.x > -.5) {
			stickNue.x = true;
		}
		if (vect.y < .5 &&
			vect.y > -.5) {
			stickNue.y = true;
		}
	}

	async parse(btns, stks, trigs, type) {
		if (type && this.gamepadType != type) {
			let res = false;
			for (let i in btns) {
				let btn = btns[i];
				let val;
				if (typeof btn == 'boolean') {
					val = btn;
				} else {
					val = btn.query();
				}
				if (val) {
					res = true;
				}
			}
			if (res) {
				this.gamepadType = type;
				this.mapButtons();
			} else {
				return;
			}
		}

		await this.parseBtns(btns);
		this.sticks(stks);
	}

	async loop() {
		let type = this.gamepadType;
		if (!gamepadConnected && gamepad.isConnected()) {
			if ((/xbox/i).test(gamepad.gamepad.id)) {
				type = 'xbox';
			} else if ((/(ps\d|playstation)/i).test(gamepad.gamepad.id)) {
				type = 'ps';
			} else if ((/(nintendo|switch|joy *con|gamecube)/i).test(gamepad.gamepad.id)) {
				type = 'nintendo';
			}
			log('controller detected: ' + gamepad.gamepad.id);
			log('using the ' + type + ' gamepad mapping profile');
			if (this.onChange) {
				await this.onChange(this.ui, this.uiSub, true);
			}
			$('html').addClass('cui-gamepadConnected');
			gamepadConnected = true;
		}
		if (gamepadConnected || gamepad.isConnected()) {
			let stks = {
				left: gamepad.stick('left').query(),
				right: gamepad.stick('right').query()
			};
			let trigs;
			await this.parse(btns, stks, trigs, type);
		}
		var _this = this;
		requestAnimationFrame(function() {
			_this.loop();
		});
	}

	start(options) {
		this.opt = options || {};
		if (this.opt.gca) {
			try {
				require('./gca.js')();
			} catch (ror) {
				er(ror);
			}
		}
		this.addListeners();
		this.loop();
		$(window).resize(this.resize);
	};

	bind(binding, act) {
		if (binding == 'wheel') {
			window.addEventListener('wheel', (event) => {
				event.preventDefault();
				event.stopPropagation();
				if ($('.uie.selected').length) return false;
				let scrollDelta = event.deltaY;
				// log(event);
				if (mouse.wheel.smooth) {
					pos += scrollDelta * mouse.wheel.multi;
				} else {
					if (scrollDelta < 0) {
						pos += mouseWheelDeltaNSS;
					} else {
						pos -= mouseWheelDeltaNSS;
					}
				}
				this.scrollTo(pos, ((!mouse.wheel.smooth) ? 2000 : 0));
				return false;
			}, {
				passive: false
			});
		} else {
			Mousetrap.bind(binding, () => {
				this.doAction(act);
				return false;
			});
		}
	}

	click(elem, act) {
		$(elem).click(() => {
			this.buttonPressed(act);
		});
		// $(elem).bind('mouseheld', function(e) {
		// 	this.buttonHeld(act, 2000);
		// });
	}

	error(msg, code, stateAfterError) {
		uiAfterError = stateAfterError;
		log(msg);
		let $errMenu = $('#errMenu');
		if (!$errMenu.length) {
			$('body').append(`
				<div class="menu" id="errMenu">
  				<div class="row-y">
        		<div class="uie" name="error-okay">Okay</div>
    			</div>
				</div>`);
			$errMenu = $('#errMenu');
			$errMenu.prepend(`<h1>Error</h1><p>unknown error</p>`);
			this.addListeners('#errMenu');
		}
		$('#errMenu h1').remove();
		$('#errMenu p').remove();
		let msgArr = msg.split('\n');
		for (let i = msgArr.length - 1; i >= 0; i--) {
			$('#errMenu').prepend(`<p>${msgArr[i]}</p>`);
		}
		if (code) {
			$('#errMenu').prepend(`<h1>Error Code ${code}</h1>`);
		} else {
			$('#errMenu').prepend(`<h1>Error</h1>`);
		}
		this.change('errMenu');
	}
}

module.exports = new CUI();
