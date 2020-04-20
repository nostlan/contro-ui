let gcaJS = require('gca-js');
let adapter;

class GCA {

	constructor() {
		this.connected = false;
	}

	init() {
		process.stdin.resume();

		// Get the first detected GameCube adapter.
		adapter = gcaJS.getAdaptersList()[0];

		if (!adapter) return;

		this.start();

		process.on('SIGINT', this.exit);
		this.connected = true;
	}

	start() {
		// Start communication to the first adapter detected.
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
					for (var lbl in gamepads[i].buttons) {
						gamepads[i].buttons[lbl.replace(/(button|pad)/, '').toLowerCase()] =
							gamepads[i].buttons[lbl];
						delete gamepads[i].buttons[lbl];
					}
					cui.parse(gamepads[i].buttons, sticks, triggers, 'nintendo');

					// break after getting the first connected controller
					break;
				}
			}
		});
	}

	stop() {
		gcaJS.stopAdapter(adapter);
	}

	exit() {
		this.stop();
		process.exit();
	}
}

module.exports = new GCA();
