let gcaJS = require('gca-js');

class GCA {
	constructor() {
		this.adapters = [];
		this.connected = false;
	}

	init() {
		process.stdin.resume();

		// Get the first detected GameCube adapter.
		this.adapters = gcaJS.getAdaptersList();

		if (!this.adapters[0]) {
			console.warn('did not connect to Gamecube Controller Adapter(s)');
			return;
		}

		let i = 0;
		for (let adapter of this.adapters) {
			this.start(i, adapter);
			i++;
		}
		process.on('SIGINT', this.exit);
		this.connected = true;
	}

	start(idx, adapter) {
		if (!adapter) return;
		// Start communication to the adapter.
		gcaJS.startAdapter(adapter);

		// Begin polling status information of the adapter, and call a function // once a response has been received.
		gcaJS.pollData(adapter, (data) => {
			// Get the status of all controllers
			var gamepads = gcaJS.objectData(data);

			for (var i = 0; i < 4; i++) {
				if (gamepads[i].connected) {
					let stks = {
						left: {
							x: gamepads[i].axes.mainStickHorizontal,
							y: -gamepads[i].axes.mainStickVertical
						},
						right: {
							x: gamepads[i].axes.cStickHorizontal,
							y: -gamepads[i].axes.cStickVertical
						}
					};
					let trigs = {
						left: gamepads[i].axes.triggerL,
						right: gamepads[i].axes.triggerR
					};
					let btns = {};
					for (let lbl in gamepads[i].buttons) {
						let lbl1 = lbl.replace(/(button|pad)/, '').toLowerCase();
						btns[lbl1] = {
							pressed: gamepads[i].buttons[lbl]
						};
					}
					let contro = {
						id: 'gca-' + i * (idx + 1),
						subtype: 'gca',
						profile: 'none',
						pad: {
							id: 'Nintendo GameCube Controller'
						}
					};
					cui.parse(contro, btns, stks, trigs);
				}
			}
		});
	}

	stop(adapter) {
		if (!adapter) return;
		gcaJS.stopAdapter(adapter);
	}

	exit() {
		for (let adapter of this.adapters) {
			this.stop(adapter);
		}
		process.exit();
	}
}

module.exports = new GCA();
