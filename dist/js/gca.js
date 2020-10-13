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
			console.error('failed to connect to Gamecube Controller Adapter(s)');
			return;
		}

		for (let adapter of this.adapters) {
			this.start(adapter);
		}
		process.on('SIGINT', this.exit);
		this.connected = true;
	}

	start(adapter) {
		// Start communication to the adapter.
		gcaJS.startAdapter(adapter);

		// Begin polling status information of the adapter, and call a function // once a response has been received.
		gcaJS.pollData(adapter, function(data) {
			// Get the status of all controllers
			var gamepads = gcaJS.objectData(data);

			for (var i = 0; i < 4; i++) {
				if (gamepads[i].connected) {
					let sticks = {
						left: {
							x: gamepads[i].axes.mainStickHorizontal,
							y: -gamepads[i].axes.mainStickVertical
						},
						right: {
							x: gamepads[i].axes.cStickHorizontal,
							y: -gamepads[i].axes.cStickVertical
						}
					};
					let triggers = {
						left: gamepads[i].axes.triggerL,
						right: gamepads[i].axes.triggerR
					};
					for (let lbl in gamepads[i].buttons) {
						let lbl1 = lbl.replace(/(button|pad)/, '').toLowerCase();
						gamepads[i].buttons[lbl1] = {
							pressed: gamepads[i].buttons[lbl]
						};
						delete gamepads[i].buttons[lbl];
					}
					cui.parse(gamepads[i].buttons, sticks, triggers, 'nintendo');

					// break after getting the first connected controller
					break;
				}
			}
		});
	}

	stop(adapter) {
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
