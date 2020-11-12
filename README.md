# contro-ui

requires jQuery and Mousetrap
optionally uses gca-js for Gamecube controller support

```javascript
global.cui = require("contro-ui");
cui.start();
```

```pug
doctype html
html
  head
    title Your App
    meta(charset='utf-8')
    link(rel='stylesheet' type='text/css' href=node_modules + '/bootstrap/dist/css/bootstrap.min.css')
    link(rel='stylesheet' type='text/css' href=node_modules + '/contro-ui/dist/css/contro-ui.css')
  body
    #nameOfMenu.menu.row-y
      //- full width menu button
      .cui.col(name='actionName0') button label
      .row.row-x
        //- three buttons in horizontal row
        .cui.col(name='actionName1') other button label
        .cui.col(name='actionName1') other button label
        .cui.col(name='actionName1') other button label
    #otherMenu.menu.row-y
      //- ...
```

## API

### start(Object options)

Required to initialize contro-ui, adds event listener for gamepad connections, adds click and hover event listeners to all `.cui` elements.

_boolean options.v_  
enable verbose logging  
_boolean options.haptic_  
enable haptic feedback (controller vibrations)  
_boolean options.gca_  
enable Gamecube Controller Adapter support (requires npm package gca-js)

### async change(String state[, String subState, Object options])

Switch to another state: menu or cui context.

_boolean options.keepBackground_  
keep showing the previous ui, by default it's hidden.

### async onChange(String state[, String subState])

Override this function to do something when cui changes to a different state.

### async afterChange(String state[, String subState])

Override this function to do something after cui changes to a different state.

### async doAction(String act)

Do the specified action.

_String act_  
the action, can be a controller or keyboard action  
'a', 'b', 'x', 'y', 'l', 'r' controller face button actions  
'up', 'down', 'left', 'right' dpad/leftStick directional movement actions  
'back' change state back to the previous ui state  
'doubleBack' go back two ui states  
'quit' quit the app

### async onAction(String act)

Override this function to do something after a keyboard key or controller button press.

### async doHeldAction(String act, Number timeHeld)

Do the specified held action.

### async onHeldAction(String act, Number timeHeld)

Override this function to do something after a keyboard key or controller button is held.

### makeCursor(jQuery \$cursor[, String state])

Make \$cursor the current cursor, state is the current ui by default.

### beforeMove(jQuery \$cursor[, String state])

Override this function to do something before the cursor changes.

### afterMove(jQuery \$cursor[, String state])

Override this function to do something after the cursor changes.

### bind(String|Array keys, String act)

Bind keyboard key(s) to a controller button or cui action.

For modifier keys you can use `shift`, `ctrl`, `alt`, or `meta`.

You can substitute `option` for `alt` and `command` for `meta`.

Other special keys are `backspace`, `tab`, `enter`, `return`, `capslock`, `esc`, `escape`, `space`, `pageup`, `pagedown`, `end`, `home`, `left`, `up`, `right`, `down`, `ins`, `del`, and `plus`.

Any other key you should be able to reference by name like `a`, `/`, `$`, `*`, or `=`.

For more info look at the [Mousetrap documentation](https://craig.is/killing/mice).

```javascript
// example of binding keyboard keys
for (let char of "abcdefghijklmnopqrstuvwxyz1234567890") {
  cui.bind(char, "char-" + char);
}
cui.bind("space", "char-_");
```

### click(jQuery \$elem, String act)

Bind mouse clicking on a jQuery DOM element to a controller button or cui action. Don't use on .cui elements! Use the "name" property to set the click action for .cui elements.

### addView(String state[, Object options])

Add a menu or other cui context. Will add click listeners for any .cui elems within the view.

### editView(String state[, Object options])

Replace view options with the options object given.

### async alert(String msg, String title[, String stateAfterAlert])

msg can be text or html, if stateAfterAlert is provided cui will change to that state after the user presses the "okay" button.

### async error(String msg[, var code, String stateAfterError])

Error code can be a Number or String, calls the alert function internally.

```javascript
// example that displays unexpected errors to users
// before quitting the app
const process = require("process");
process.on("uncaughtException", ror => {
  console.error(ror);
  cui.err(`<textarea rows=8>${ror.stack}</textarea>`, "App crashed!", "quit");
});
```

### async resize(Boolean adjust, String state)

Adjust ui components (or not) on resize.

### async onResize(Boolean adjust)

Override this method to adjust ui components on resize.

### passthrough(Object contro)

Override this function to access the contro object directly, which has parsed controller button, stick, and trigger info.
