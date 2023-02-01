let dflt_btnIdxs = {
	a: 0,
	b: 1,
	x: 2,
	y: 3,
	l: 4,
	r: 5,
	lt: 6,
	rt: 7,
	select: 8,
	start: 9,
	// leftStickBtn: 10,
	// rightStickBtn: 11,
	up: 12,
	down: 13,
	left: 14,
	right: 15
};
let dflt_axeIdxs = {
	leftStick: {
		x: 0,
		y: 1
	},
	rightStick: {
		x: 2,
		y: 3
	},
	leftTrigger: 4,
	rightTrigger: 5,
	dpad: 6 // switch pro only
};
let dpadVals = {
	up: -1.0,
	upRight: -0.7142857142857143,
	right: -0.4285714285714286,
	downRight: -0.1428571428571429,
	down: 0.1428571428571428,
	downLeft: 0.4285714285714286,
	left: 0.7142857142857142,
	upLeft: 1.0,
	nuetral: -1.2857142857142856
};
const remappingProfiles = {
	xbox_ps_adaptive: {
		map: {
			a: 'b',
			b: 'a',
			x: 'y',
			y: 'x'
		},
		disable: 'ps|xbox|pc|arcade'
	},
	nintendo_adaptive: {
		map: {
			a: 'b',
			b: 'a',
			x: 'y',
			y: 'x'
		},
		enable: 'ps|xbox|pc|arcade'
	},
	xbox_ps_constant: {
		map: {
			a: 'b',
			b: 'a',
			x: 'y',
			y: 'x'
		}
	},
	nintendo_constant: {
		map: {
			a: 'b',
			b: 'a',
			x: 'y',
			y: 'x'
		}
	},
	xbox_ps_none: {
		map: {}
	},
	nintendo_none: {
		map: {}
	}
};
let gamepadMaps = {
	xbox_ps: {
		profile: 'none',
		map: {}
	},
	nintendo: {
		profile: 'none',
		map: {}
	},
	other: {
		profile: 'none',
		map: {}
	}
};
let pos = 0;
let uiAfterAlert = '';
let $cursor;
let opt = {
	v: true
};

class CuiState {
	constructor(state) {
		if (state) {
			this.init(state);
		} else {
			this.$elem = $();
		}
	}

	init(state) {
		// already initialized
		if (this.state) return;

		let split = state.split('_');
		if (split.length > 1) {
			state = split[0];
			this.level = Number(split[1]);
			this.id = `${state}_${this.level}`;
		} else {
			let level = 0;
			for (let i = 0; i < 1000; i++) {
				if ($('#' + state + '_' + i).length) {
					level = i;
					break;
				}
			}
			this.level = level;

			let id = `${state}`;
			if (level > 0) id += `_${level}`;
			this.id = id;
		}

		this.state = state;

		this.$elem = $('#' + this.id);
	}
}

class CUI {
	constructor() {
		this.er = this.error;
		this.err = this.error;
		this.opt = {}; // options
		this.ui = ''; // current ui state
		this.uiSub = ''; // current ui substate
		this.uiPrev = ''; // previous ui state
		this.history = []; // array of previous ui states
		this.players = []; // array of players' contro id
		this.contros = {}; // controllers
		// keyboard mappings to actions
		this.keyboard = {
			bound: {}
		};
		// mouse preferences
		this.mouse = {
			wheel: {
				multi: 1,
				delta: 500,
				smooth: require('os').type() == 'Darwin'
			}
		};
		// current context (for controller mapping)
		this.context = 'PC';
		// convert analog sticks to dpad button presses
		// useful for game controller contexts where the original
		// controller did not have analog sticks
		this.convertStcksToDpad = false;

		this.State = CuiState;
	}

	async onChange(state, subState) {
		// log('cui: override this method: cui.onChange');
	}
	async afterChange(state, subState) {
		// log('cui: override this method: cui.afterChange');
	}
	async onResize() {
		// log('cui: override this method: cui.onResize');
	}
	async onAction(act) {
		// log('cui: override this method: cui.onAction');
	}
	async onHeldAction(act, timeHeld) {
		// log('cui: override this method: cui.onHeldAction');
	}
	beforeMove($cursor, state) {
		// log('cui: override this method: cui.beforeMove');
	}
	afterMove($cursor, state) {
		// log('cui: override this method: cui.afterMove');
	}

	isButton(act) {
		return Object.keys(dflt_btnIdxs).includes(act);
	}

	mapControBtns(contro) {
		let type = contro.type;
		if (type == 'xbox' || type == 'ps') {
			type = 'xbox_ps';
		}
		let gm = gamepadMaps[type];
		gm.profile = contro.profile || gm.profile;
		if (contro.type == 'other') type = 'xbox_ps';
		let prof = remappingProfiles[type + '_' + gm.profile];
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
		if ((!enable || enable.test(this.context)) && (!disable || !disable.test(this.context))) {
			// log('cui: controller remapping enabled for ' + this.context);
			contro.map = {};
			for (let i in prof.map) {
				contro.map[i] = gm.map[prof.map[i]] || prof.map[i];
			}
		} else {
			// log('cui: no controller remapping for ' + this.context);
			contro.map = {};
		}

		// normalize X and Y to nintendo physical layout
		// this will make the physical layout of an app constant
		// and doAction choices constant for certain buttons
		if (
			this.opt.normalize &&
			((this.opt.normalize.disable && !new RegExp(`(${this.opt.normalize.disable})`, 'i').test(gm.profile)) ||
				(this.opt.normalize.enable && new RegExp(`(${this.opt.normalize.enable})`, 'i').test(gm.profile)))
		) {
			for (let i in this.opt.normalize.map) {
				contro.map[i] = gm.map[this.opt.normalize.map[i]] || this.opt.normalize.map[i];
			}
		}
	}

	mapButtons(context) {
		this.context = context || this.context;
		for (let id in this.contros) {
			this.mapControBtns(this.contros[id]);
		}
		this.convertStcksToDpad = /(nes|snes)/.test(this.context);
	}

	isParent(ui, state) {
		return (ui ? this[ui].level : 0) < this[state].level;
	}

	getParent(ui) {
		ui = ui ? ui : this.ui;
		let curLevel = this[ui].level;
		for (let i = this.history.length - 1; i >= 0; i--) {
			if (ui == this.history[i]) continue;
			let prevLevel = this[this.history[i]].level;
			if (prevLevel > curLevel) continue;
			return this.history[i];
		}
	}

	async doAction(act) {
		if (this.ui == 'alertMenu' && act == 'a') {
			cui.finishAlert();
			act = uiAfterAlert;
			uiAfterAlert = '';
			if (act == 'quit') {
				return await this.doAction('quit');
			}
			if (!act) {
				act = 'back';
			} else if (act != 'doubleBack' && act != 'back') {
				await this.change(act);
				return;
			}
		}
		if (act == 'back') {
			await this.change(this.getParent());
		} else if (act == 'doubleBack') {
			act = this.getParent();
			this[act].$elem.hide();
			act = this.getParent(act);
			await this.change(act);
		} else {
			if (act == 'a' || act == 'enter') {
				act = 'a';
				if (this.$cursor && this.$cursor.length) {
					act = this.$cursor.attr('name') || 'a';
					this.$cursor.addClass('active');
					await delay(100);
					this.$cursor.removeClass('active');
				}
			}
			if (this.opt.v) {
				log('cui: ' + act + ' on ' + this[this.ui].id);
			}
			let res = true;
			if (this.onAction) {
				res = await this.onAction(act);
			}
			if (res && this.ui && this[this.ui].onAction) {
				await this[this.ui].onAction(act);
			}
		}
	}

	async doHeldAction(act, timeHeld) {
		let res = true;
		if (this.onHeldAction) {
			res = await this.onHeldAction(act, timeHeld);
		}
		if (res && this.ui && this[this.ui].onHeldAction) {
			await this[this.ui].onHeldAction(act, timeHeld);
		}
	}

	async resize() {
		if (this.onResize) {
			await this.onResize();
		}
		if (this.ui && this[this.ui].onResize) {
			await this[this.ui].onResize();
		}
	}

	get $cursor() {
		return (this[this.ui] || {}).$cursor || $('');
	}

	getCursor(state) {
		return (this[state || this.ui] || {}).$cursor || $('');
	}

	hasReels(ui) {
		return $('#' + this[ui].id + '.reels').length;
	}

	scrollTo(position, time) {
		if (isNaN(position)) {
			log(`cui: pos can't be: ` + position);
			return;
		}
		pos = position;
		// if (this.opt.v) log(pos.toFixed(1));
		time = time == undefined ? 2000 : time;

		let $reels;
		if (this.hasReels(this.ui)) {
			$reels = this[this.ui].$elem.find('.reel');
		} else if (/select/i.test(this.ui)) {
			$reels = this[this.getParent(this.ui)].$elem.find('.reel');
		} else {
			return;
		}
		for (let i = 0; i < $reels.length; i++) {
			let $reel = $reels.eq(i);
			let reelPos = pos;
			if ($reel.hasClass('reverse')) {
				// is reverse
				reelPos = $reels.eq(1)[0].scrollHeight - window.innerHeight - pos;
			}

			if (time != 0) {
				$reel.stop().animate(
					{
						scrollTop: reelPos
					},
					time,
					'swing'
				);
			} else {
				$reel[0].scrollTop = reelPos;
			}
		}
	}

	scrollToCursor(time, minDistance) {
		if (this.opt.v) log($cursor);
		let $reel = $cursor.parent();
		let $reels = $reel.parent().children();
		let position = 0;
		for (let i = 0; i < $cursor.index(); i++) {
			position += $reel.children().eq(i).height();
		}
		position += $cursor.height() * 0.5;
		if ($reel.hasClass('reverse')) {
			position = $reels.eq(1)[0].scrollHeight - window.innerHeight - position;
			position += window.innerHeight * 0.5;
		} else {
			position -= window.innerHeight * 0.5;
		}
		let scrollDist = Math.abs(pos - position);
		minDistance ??= 0.4;
		if (!/select/i.test(this.ui) && scrollDist < window.innerHeight * minDistance) return;
		let sTime;
		if (time > -1) {
			sTime = time || 1;
		} else {
			sTime = (window.innerHeight * 2 - $cursor.height()) / 5;
		}
		if (this.opt.haptic) {
			this.vibrate(76, true);
		}
		this.scrollTo(position, sTime);
	}

	removeCursor() {
		if (!$cursor) {
			return;
		}
		$cursor.removeClass('cursor');
	}

	makeCursor($newCursor, state) {
		if (!$newCursor) return;
		state = state || this.ui;
		if (this.beforeMove && $newCursor != $cursor) {
			this.beforeMove($cursor, state);
		}
		if (state && this[state].beforeMove && $newCursor != $cursor) {
			this[state].beforeMove($cursor, state);
		}
		this.removeCursor();
		$cursor = $newCursor;
		$cursor.addClass('cursor');
		if (!this[state]) this[state] = {};
		this[state].$cursor = $cursor;
		if (this.afterMove) {
			this.afterMove($newCursor, state);
		}
		if (state && this[state].afterMove) {
			this[state].afterMove($cursor, state);
		}
	}

	addView(state, options) {
		this.editView(state, options);
		this.addListeners(this[state].id);
	}

	editView(state, options) {
		options = options || {};
		let _state = state;
		state = state.split('_')[0];
		if (!this[state]) {
			this[state] = new this.State(_state);
		} else {
			this[state].init(_state);
		}
		Object.assign(this[state], options);
	}

	removeView(state) {
		if (!this[state].$elem.length) return;
		let el = this[state].$elem[0];
		while (el.hasChildNodes()) {
			el.removeChild(el.lastChild);
		}
		if (/main/i.test(state)) {
			this.uiPrev = null;
		}
	}

	setUISub(subState, appendSubState) {
		if (!subState) return;
		if (!appendSubState) {
			$('body').removeClass(this.uiSub);
		}
		$('body').addClass(subState);
		this.uiSub = subState;
	}

	/**
	 * Switch to another state: menu or cui context.
	 *
	 * @param {String}  state          state of the UI.
	 * @param {String}  [subState]       subState of the UI.
	 * @param {Object}  [options={}]
	 * @param {Boolean} [options.keepBackground=false]
	 * @return void
	 */
	async change(state, subState, options) {
		options = options || {};
		let _state = state;
		state = state.split('_')[0];
		if (!this[state]) {
			this[state] = new this.State(_state);
		} else {
			this[state].init(_state);
		}
		let id = this[state].id;
		if (state == this.ui) {
			await this.doAction('b');
			return;
		}
		if (this.ui) this.history.push(this.ui);
		this.uiPrev = this.ui;
		this[state].$elem.show();
		if (this.onChange) {
			await this.onChange(state, subState || this.uiSub);
		}
		if (this[state] && this[state].onChange) {
			await this[state].onChange(state, subState || this.uiSub);
		}
		if (this.hasReels(state)) {
			if (!this[state] || !this[state].$cursor || !$('body').find(this[state].$cursor).length) {
				let $mid = $(`#${id} .reel.r0`).children();
				$mid = $mid.eq(Math.round($mid.length * 0.5) - 1);
				this.makeCursor($mid, state);
			} else {
				this.makeCursor(this[state].$cursor, state);
			}
			this.scrollToCursor(0, 0);
		} else if (/select/i.test(state)) {
			this.makeCursor(this[this.getParent(state)].$cursor, state);
		} else {
			let $temp;
			$temp = $(`#${id}.row-y`).eq(0).find('.cui').eq(0);
			if (!$temp.length) {
				$temp = $(`#${id}.row-x`).eq(0).find('.cui').eq(0);
			}
			if (!$temp.length) {
				$temp = $(`#${id} .row-y`).eq(0).find('.cui').eq(0);
			}
			if (!$temp.length) {
				$temp = $(`#${id} .row-x`).eq(0).find('.cui').eq(0);
			}
			this.makeCursor($temp, state);
		}
		$('body').removeClass(this.ui);
		$('body').addClass(state);
		let isChild = !this.isParent(this.ui, state);
		if (
			this.ui &&
			!options.keepBackground &&
			/menu/i.test(this.ui) &&
			(!this[this.ui].keepBackground || isChild) &&
			(!/select/i.test(state) || isChild)
		) {
			this[this.ui].$elem.hide();
		} else {
			// log('cui: keeping prev ui in background');
		}
		this.ui = state;
		this.id = id;
		this.setUISub(subState);
		if (this.opt.v && this.uiPrev) {
			log('cui: ' + this[this.uiPrev].id + ' to ' + this[state].id);
		}
		if (this.afterChange) {
			await this.afterChange();
		}
		if (this.ui && this[this.ui].afterChange) {
			await this[this.ui].afterChange(state, subState || this.uiSub);
		}
	}

	addListeners(id) {
		if (!id) {
			id = '';
		} else if (id.charAt(0) != '#') {
			id = '#' + id;
		}
		const _this = this;

		let $cuis = $(id + ' .cui');

		for (let i = 0; i < $cuis.length; i++) {
			let el = $cuis.eq(i)[0];
			el.onclick = function () {
				if (_this[_this.ui].clickCurDisabled) return;
				let classes = $(this).attr('class').split(' ');
				if (classes.includes('cui-disabled')) return;
				if (classes.includes('cursor') || _this[_this.ui].hoverCurDisabled) {
					_this.makeCursor($(this));
					_this.buttonPressed('a');
				} else {
					_this.buttonPressed('b');
				}
			};
			el.onmouseover = function () {
				if (!_this[_this.ui].hoverCurDisabled && $(this).parents('#' + _this.id).length) {
					_this.makeCursor($(this));
				}
			};
		}
	}

	async _move(direction) {
		document.body.requestPointerLock();
		let $rowX = $cursor.closest('.row-x');
		let $rowY = $cursor.closest('.row-y');
		let curX, curY, maxX, maxY;
		let inVerticalRow = $rowX.has($rowY.get(0)).length || !$rowX.length;
		if (inVerticalRow) {
			curX = $rowX.find('.row-y').index($rowY);
			maxX = $rowX.find('.row-y').length;
			curY = $rowY.find('.cui').index($cursor);
			maxY = $rowY.find('.cui').length;
		} else {
			curX = $rowX.find('.cui').index($cursor);
			maxX = $rowX.find('.cui').length;
			curY = $rowY.find('.row-x').index($rowX);
			maxY = $rowY.find('.row-x').length;
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
			$cursor: $cursor,
			$rowX: $rowX,
			$rowY: $rowY
		};
		if (x < 0) x = maxX - 1;
		if (y < 0) y = maxY - 1;
		if (x >= maxX) x = 0;
		if (y >= maxY) y = 0;
		// find scale if menu is scaled
		let scale;
		let transform = $cursor.parent().parent().css('transform');
		if (transform) {
			let matches = transform.match(/scale\(([\d\.]+)/);
			if (!matches) matches = transform.match(/matrix\(([\d\.]+)/);
			if (matches) {
				scale = Number(matches[1]); // divide by scale
			}
		}
		if (!scale) scale = 1;

		if (this.opt.haptic) {
			this.vibrate(50, false);
		}

		if (inVerticalRow) {
			if (x == curX) {
				ret.$cursor = $rowY.find('.cui').eq(y);
			} else {
				if (!$rowX.length) return;
				ret.$rowY = $rowX.find('.row-y').eq(x);
				if (!ret.$rowY.length) return;
				let curRect = $cursor.get(0).getBoundingClientRect();
				let rowYLength = ret.$rowY.find('.cui').length;
				if (y >= rowYLength) y = Math.floor(rowYLength / 2);
				while (y < rowYLength && y >= 0) {
					ret.$cursor = ret.$rowY.find('.cui').eq(y);
					let elmRect = ret.$cursor.get(0).getBoundingClientRect();
					let diff = (curRect.top - elmRect.top) / scale;
					let halfHeight = Math.max($cursor.height(), ret.$cursor.height()) * 0.6;
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
			if (y == curY) {
				ret.$cursor = $rowX.find('.cui').eq(x);
			} else {
				if (!$rowY.length) return;
				ret.$rowX = $rowY.find('.row-x').eq(y);
				if (!ret.$rowX.length) return;
				let curRect = $cursor.get(0).getBoundingClientRect();
				let rowXLength = ret.$rowX.find('.cui').length;
				if (x >= rowXLength) x = Math.floor(rowXLength / 2);
				while (x < rowXLength && x >= 0) {
					ret.$cursor = ret.$rowX.find('.cui').eq(x);
					let elmRect = ret.$cursor.get(0).getBoundingClientRect();
					let diff = (curRect.left - elmRect.left) / scale;
					let halfWidth = Math.max($cursor.width(), ret.$cursor.width()) * 0.6;
					if (halfWidth < diff) {
						x++;
					} else if (-halfWidth > diff) {
						x--;
					} else {
						break;
					}
				}
			}
		}
		if (!ret.$cursor.length) return;
		this.makeCursor(ret.$cursor);
		this.scrollToCursor();
		return true;
	}

	async move(direction) {
		// TODO enable only if game wants to
		// auto-map left stick to dpad
		// contro.btnStates[direction] = contro.btnStates[direction] || 1;

		let res = await this._move(direction);
		await this.doAction(direction);
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
		if (['up', 'down', 'left', 'right'].includes(lbl)) {
			await this.move(lbl);
		} else if (['a', 'b', 'x', 'y', 'l', 'r', 'lt', 'rt', 'select', 'start'].includes(lbl)) {
			await this.doAction(lbl);
		} else if (this.opt.v) {
			log('cui: button does nothing');
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
		if (['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'lt', 'rt', 'select', 'start'].includes(lbl)) {
			await this.doHeldAction(lbl);
		} else if (this.opt.v) {
			log('cui: button does nothing');
		}
	}

	parseBtns(contro, btns) {
		for (let i in btns) {
			let btn = btns[i];
			if (!btn) continue;
			let query;
			// incomplete maps are okay
			// no one to one mapping necessary
			i = contro.map[i] || i;
			let isDpadBtn = /(up|down|left|right)/.test(i);
			if (contro.subtype != 'switch-pro' || !isDpadBtn) {
				query = btn.pressed;
			} else {
				query = Math.abs(dpadVals[i] - contro.pad.axes[9]) < 0.1;
			}
			// if button is not pressed, query is false and unchanged
			if (!contro.btnStates[i] && !query) continue;
			// if button press ended query is false
			if (
				!query &&
				(!isDpadBtn ||
					!this.convertStcksToDpad ||
					(/(up|down)/.test(i) && contro.stickNue.y) ||
					(/(left|right)/.test(i) && contro.stickNue.x))
			) {
				// log(i + ' button press end');
				contro.btnStates[i] = 0;
				continue;
			}
			// if button is held, query is true and unchanged
			// save button state change
			contro.btnStates[i] += 1;
			if (contro.btnStates[i] == 1) {
				this.buttonPressed(i);
			} else {
				this.buttonHeld(i, contro.btnStates[i] * 16);
			}

			if (!this.players.includes(contro.id)) {
				this.players.push(contro.id);
			}
		}
	}

	sticks(contro, stks) {
		if (contro.disableSticks) return;
		let didMove = false;
		let vect = stks.left;
		let stickNue = contro.stickNue;
		if (vect.y < -0.5) {
			// used to move in contro-ui menus
			if (stickNue.y) this.move('up');
			// converts stick movement to dpad button presses
			// when using passthrough for certain contexts
			if (this.convertStcksToDpad) contro.btnStates.up++;
			stickNue.y = false;
		} else if (vect.y > 0.5) {
			if (stickNue.y) this.move('down');
			if (this.convertStcksToDpad) contro.btnStates.down++;
			stickNue.y = false;
		} else {
			stickNue.y = true;
		}
		if (vect.x < -0.5) {
			if (stickNue.x) this.move('left');
			if (this.convertStcksToDpad) contro.btnStates.left++;
			stickNue.x = false;
		} else if (vect.x > 0.5) {
			if (stickNue.x) this.move('right');
			if (this.convertStcksToDpad) contro.btnStates.right++;
			stickNue.x = false;
		} else {
			stickNue.x = true;
		}
	}

	parseTrigs(contro, trigs) {
		if (typeof trigs.left == 'undefined') return;
		if (trigs.left > 0.9) {
			contro.btnStates.lt++;
		} else {
			contro.btnStates.lt = 0;
		}
		if (trigs.right > 0.9) {
			contro.btnStates.rt++;
		} else {
			contro.btnStates.rt = 0;
		}
	}

	parse(contro, btns, stks, trigs) {
		if (!this.contros[contro.id]) {
			contro = this.addContro(contro);
			this.mapControBtns(contro);
		} else {
			contro = this.contros[contro.id];
		}
		this.parseBtns(contro, btns);
		this.sticks(contro, stks);
		this.parseTrigs(contro, trigs);

		if (!this.passthrough) return;

		for (let i in this.players) {
			if (contro.id != this.players[i]) continue;
			this.passthrough({
				port: Number(i),
				btns: contro.btnStates,
				stks: stks,
				trigs: trigs
			});
		}
	}

	vibrate(duration, strongly) {
		if (!this.players[0]) return;
		let contro = this.contros[this.players[0]];
		if (contro.subtype == 'gca') return;
		const actuator = contro.pad.vibrationActuator;
		if (!actuator || actuator.type !== 'dual-rumble') return;

		actuator.playEffect('dual-rumble', {
			startDelay: 0,
			duration: duration,
			weakMagnitude: strongly ? 1 : 0,
			strongMagnitude: strongly ? 1 : 0
		});
	}

	makePlayer1(contro) {
		this.disconnectPlayer(contro);
		this.players.unshift(contro.id);
	}

	disconnectPlayer(contro) {
		for (let i in this.players) {
			if (contro.id != this.players[i]) continue;
			this.players.splice(1, i);
		}
	}

	pollContro(contro) {
		if (contro.subtype == 'gca') return;
		contro.pad = navigator.getGamepads()[contro.id];
		// gamepad disconnected
		if (!contro.pad) {
			this.disconnectPlayer(contro);
			return;
		}
		let btns = {};
		let pad = contro.pad;
		for (let i in contro.btnIdxs) {
			btns[i] = pad.buttons[contro.btnIdxs[i]];
		}
		let stks = {
			left: {
				x: pad.axes[contro.axeIdxs.leftStick.x],
				y: pad.axes[contro.axeIdxs.leftStick.y]
			},
			right: {
				x: pad.axes[contro.axeIdxs.rightStick.x],
				y: pad.axes[contro.axeIdxs.rightStick.y]
			}
		};
		let trigs = {
			left: pad.axes[contro.axeIdxs.leftTrigger],
			right: pad.axes[contro.axeIdxs.rightTrigger]
		};
		this.parse(contro, btns, stks, trigs);
	}

	loop() {
		for (let id in this.contros) {
			this.pollContro(this.contros[id]);
		}
		var _this = this;
		requestAnimationFrame(() => {
			_this.loop();
		});
	}

	addContro(contro) {
		contro.pad = navigator.getGamepads()[contro.id] || contro.pad;
		contro.type = contro.type || 'other';
		contro.profile = contro.profile || null;
		contro.disableSticks = false;
		contro.btnIdxs = contro.btnIdxs || dflt_btnIdxs;
		contro.axeIdxs = contro.axeIdxs || dflt_axeIdxs;
		let id = contro.pad.id;
		if (/xbox/i.test(id)) {
			contro.type = 'xbox';
		} else if (/(ps\d|ds\d|dual *shock|six *axis|playstation)/i.test(id)) {
			contro.type = 'ps';
		} else if (/(nintendo|wii|switch|joy *con)/i.test(id)) {
			contro.type = 'nintendo';
		} else if (/(plus|Vendor: 20d6 Product: a711)/i.test(id)) {
			let btnIdxs = contro.btnIdxs;
			btnIdxs.a = 2;
			btnIdxs.b = 1;
			btnIdxs.x = 0;
			btnIdxs.y = 3;
			btnIdxs.l = 4;
			btnIdxs.r = 5;
			btnIdxs.select = 8;
			btnIdxs.start = 9;
			contro.type = 'nintendo';
			contro.subtype = 'switch-pro';
		}
		// initialize button states
		contro.btnStates = {};
		for (let i in contro.btnIdxs) {
			contro.btnStates[i] = 0;
		}
		contro.stickNue = {
			x: true,
			y: true
		};
		contro.map = contro.map || {};
		log('cui: controller detected: ' + id);
		log('cui: using the ' + contro.type + ':' + contro.subtype + ' gamepad mapping profile');
		this.contros[contro.id] = contro;
		if (this.opt.haptic) {
			this.vibrate(100, true);
		}
		// if (this.onChange) {
		// 	this.onChange(this.ui, this.uiSub);
		// }
		return this.contros[contro.id];
	}

	start(options) {
		this.opt = options || {};
		gamepadMaps = this.opt.gamepadMaps || gamepadMaps;
		let _this = this;
		window.addEventListener('gamepadconnected', (e) => {
			let contro = _this.addContro({
				id: e.gamepad.index
			});
			_this.mapControBtns(contro);
		});
		if (this.opt.gca) {
			try {
				this.gca = {};
				this.gca = require('./gca.js');
				this.gca.init();
			} catch (ror) {
				er(ror);
			}
		}
		this.addListeners();
		this.loop();
		addEventListener('resize', () => {
			this.resize();
		});
	}

	// bind key to bindings
	keyPress(key, bindings) {
		if (typeof bindings == 'string') {
			bindings = [
				{
					state: 'default',
					act: bindings
				}
			];
		} else if (!Array.isArray(bindings)) {
			bindings = [bindings];
		}

		for (let binding of bindings) {
			binding.state = binding.state || 'default';
			if (!this.keyboard[binding.state]) {
				this.keyboard[binding.state] = {
					keys: {},
					contros: []
				};
			}
			this.keyboard[binding.state].keys[key] = {
				press: 0,
				act: binding.act,
				port: Number(binding.port || 0)
			};
		}
		// no need to rebind key
		if (this.keyboard.bound[key]) return;

		Mousetrap.bind(
			key,
			() => {
				let state = this.ui;
				if (!this.keyboard[state]) state = this.uiSub;
				if (!this.keyboard[state]) state = 'default';
				if (!this.keyboard[state]) return false;
				let keys = this.keyboard[state].keys;
				if (!keys[key]) keys[key] = {};
				let k = keys[key];
				k.press += 1;

				if (k.press == 1 && k.act) {
					if (/(up|down|left|right)/.test(k.act)) {
						this.move(k.act);
					} else {
						this.doAction(k.act);
					}
				} else if (k.act) {
					this.doHeldAction(k.act, k.press * 86);
				}
				if (!this.passthrough || k.port === undefined || !this.isButton(k.act)) {
					return false;
				}
				if (!this.keyboard[state].contros[k.port]) {
					this.keyboard[state].contros[k.port] = {
						port: k.port
					};
				}
				let contro = this.keyboard[state].contros[k.port];
				if (!contro.btns) contro.btns = {};
				contro.btns[k.act] = k.press;
				this.passthrough(contro);
				return false;
			},
			'keydown'
		);

		Mousetrap.bind(
			key,
			() => {
				let state = this.ui;
				if (!this.keyboard[state]) state = this.uiSub;
				if (!this.keyboard[state]) state = 'default';
				if (!this.keyboard[state]) return false;
				let k = this.keyboard[state].keys[key];
				if (!k) return false;
				k.press = 0;

				if (!this.passthrough || k.port === undefined || !this.isButton(k.act)) {
					return false;
				}
				if (!this.keyboard[state].contros[k.port]) {
					this.keyboard[state].contros[k.port] = {
						port: k.port
					};
				}
				let contro = this.keyboard[state].contros[k.port];
				if (!contro.btns) contro.btns = {};
				contro.btns[k.act] = 0;
				this.passthrough(contro);
				return false;
			},
			'keyup'
		);
		this.keyboard.bound[key] = true;
	}

	bindWheel($reels) {
		$reels[0].addEventListener(
			'wheel',
			(event) => {
				event.preventDefault();
				event.stopPropagation();
				if ($('.cui.selected').length) return false;
				let scrollDelta = event.deltaY;
				pos += scrollDelta * this.mouse.wheel.multi;
				this.scrollTo(pos, !this.mouse.wheel.smooth ? 1500 : 0);
				return false;
			},
			{
				passive: false
			}
		);
	}

	click($elem, act) {
		$elem[0].onclick = () => {
			this.buttonPressed(act);
		};
		// $(elem).bind('mouseheld', function(e) {
		// 	this.buttonHeld(act, 2000);
		// });
	}

	async alert(msg, title, stateAfterAlert) {
		if (typeof msg != 'string') return;
		uiAfterAlert = stateAfterAlert;
		log('cui: ' + msg);
		let $alertMenu = $('#alertMenu_9999');
		if (!$alertMenu.length) {
			$('body').prepend(`
				<div class="menu" id="alertMenu_9999">
  				<div class="row-y">
        		<div class="cui opt0" name="alert-okay">Okay</div>
    			</div>
				</div>`);
			$alertMenu = $('#alertMenu_9999');
			this.addListeners('#alertMenu_9999');
		}
		$('#alertMenu_9999 > :not(.row-y)').remove();
		if (/<[^>]*>/.test(msg)) {
			$('#alertMenu_9999').prepend(msg);
		} else {
			let msgArr = msg.split('\n');
			for (let i = msgArr.length - 1; i >= 0; i--) {
				$('#alertMenu_9999').prepend(`<p>${msgArr[i]}</p>`);
			}
		}
		if (title) $('#alertMenu_9999').prepend(`<h1>${title}</h1>`);
		await this.change('alertMenu_9999');
		if (stateAfterAlert == 'quit') {
			$('#alertMenu_9999 .opt0').text('close');
			// stop
			await delay(100000000000);
		}
		$alertMenu.removeClass('dim');
		return new Promise((resolve) => {
			cui.finishAlert = () => {
				resolve(true);
			};
		});
	}

	async error(msg, code, stateAfterError) {
		console.error(msg);
		let title;
		if (typeof code == 'string') {
			title = code;
		} else if (code) {
			title = 'Error Code ' + code;
		} else {
			title = 'Error';
		}
		await this.alert(msg, title, stateAfterError);
	}
}

module.exports = new CUI();
