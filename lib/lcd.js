// Initial LCD draft based on Andreas Haugstrup Pedersen's
// proof of concept: https://gist.github.com/3200887
//
//
//
var Board = require("../lib/board.js"),
    events = require("events"),
    util = require("util"),
    __ = require("../lib/fn.js"),
    es6 = require("es6-collections"),
    WeakMap = es6.WeakMap


var DeviceMap,
    priv = new WeakMap();

DeviceMap = {

};

function sleep( milliSeconds ) {
  var startTime = Date.now();
  while (Date.now() < startTime + milliSeconds);
}

function write4Bits( value ) {
  for (var i = 0; i < 4; i++) {
    this.board.digitalWrite( this.pins.data[i], (value >> i) & 1 )
  }

  this.pulse();
}

/**
 * LCD
 * @param {[type]} opts [description]
 */
function LCD( opts ) {

  if ( !(this instanceof LCD) ) {
    return new LCD( opts );
  }

  opts = Board.options( opts );

  // Hardware instance properties
  this.board = Board.mount( opts );
  this.firmata = this.board.firmata;


  this.pins = {
    rs: opts.pins[0],
    en: opts.pins[1],
    // TODO: Move to device map profile
    data: [
      opts.pins[5],
      opts.pins[4],
      opts.pins[3],
      opts.pins[2]
    ]
  };

  this.lines = opts.lines || 2;
  this.fourBitMode = true; // opts.fourBitMode;

  this.displayFunction =  LCD.BITMODE[ this.fourBitMode ? 4 : 8 ] |
                          LCD.LINE[ this.lines ] |
                          LCD.DOTS['5x8'];

  this.displayControl =   LCD.DISPLAYON | LCD.CURSOROFF | LCD.BLINKOFF;

  this.displayMode =      LCD.ENTRYLEFT | LCD.ENTRYSHIFTDECREMENT;

  // TODO: ALL OF THIS NEEDS TO BE RE-WRITTEN
  //
  //
  // RS to low (for command mode), EN to low to start
  // TODO: Move to device map profile
  this.board.digitalWrite( this.pins.rs, this.firmata.LOW );
  this.board.digitalWrite( this.pins.en, this.firmata.LOW );

  // Wait 50ms before initializing to make sure LCD is powered up
  // TODO: Don't use sleep
  setTimeout(function() {

    if (this.fourBitMode) {
      // Send 0011 thrice to make sure LCD is initialized properly
      write4Bits.call( this, 0x03 );
      sleep(5);
      write4Bits.call( this, 0x03 );
      sleep(5);
      write4Bits.call( this, 0x03 );
      sleep(1);

      // Switch to 4-bit mode
      // TODO: Move to device map profile
      write4Bits.call(this, 0x02);
    } else {
      this.command( LCD.FUNCTIONSET | this.displayFunction );
      sleep(5);
      this.command( LCD.FUNCTIONSET | this.displayFunction );
      sleep(1);
      this.command( LCD.FUNCTIONSET | this.displayFunction );
    }

    this.command( LCD.FUNCTIONSET | this.displayFunction );

    // Clear display and turn it on
    this.clear();
    this.display();
    this.command( LCD.ENTRYMODESET | this.displayMode );

    this.ready = true;
  }.bind(this), 50);
}

LCD.prototype.pulse = function() {
  [ 'HIGH', 'LOW' ].forEach(function(val) {
    this.board.digitalWrite(this.pins.en, this.firmata[val] );
  }, this);
};

LCD.prototype.display = function() {
  this.displayControl = this.displayControl | LCD.DISPLAYON;
  this.command( LCD.DISPLAYCONTROL | this.displayControl );
};

LCD.prototype.noDisplay = function() {
  this.displayControl = this.displayControl & !LCD.DISPLAYON;
  this.command( LCD.DISPLAYCONTROL | this.displayControl );
};

LCD.prototype.command = function(command /* integer, 0-255 */, callback) {
  var pin = 0;
  var bitValue;

  // TODO: use write4Bits, write8Bits instead
  for (var i = 0; i < 8; i++) {
    bitValue = this.board.firmata[ (command >> i) & 0x01 ? 'HIGH' : 'LOW' ];
    this.board.digitalWrite( this.pins.data[pin], bitValue );
    pin++;

    if (this.fourBitMode && pin === 4) {
      this.pulse();
      pin = 0;
    }
  }

  if ( callback ) {
    process.nextTick(callback);
  }
};

LCD.prototype.write = function( message ) {

  // If the LCD is not ready, try again until it is.
  if ( !this.ready ) {
    setTimeout(function() {
      this.write( message );
    }.bind(this), 0);
  } else {
    // Otherwise, make with writing to the device

    // Clear
    this.board.digitalWrite( this.pins.rs, this.firmata.LOW );
    this.clear();

    // Prepare
    this.board.digitalWrite( this.pins.rs, this.firmata.HIGH );

    [].slice.call( String(message) ).forEach(function( char ) {
      this.command( char.charCodeAt(0), function() {
        sleep(200);
      });
    }, this );

    this.board.digitalWrite( this.pins.rs, this.firmata.LOW );
  }
};

LCD.prototype.clear = function() {
  this.command( LCD.CLEARDISPLAY );
};

/**
 *

begin()
clear()
home()
setCursor()
burst()
print()
cursor()
noCursor()
blink()
noBlink()
display()
noDisplay()
scrollDisplayLeft()
scrollDisplayRight()
autoscroll()
noAutoscroll()
leftToRight()
rightToLeft()
createChar()


*/


// commands
LCD.CLEARDISPLAY = 0x01
LCD.RETURNHOME = 0x02
LCD.ENTRYMODESET = 0x04
LCD.DISPLAYCONTROL = 0x08
LCD.CURSORSHIFT = 0x10
LCD.FUNCTIONSET = 0x20
LCD.SETCGRAMADDR = 0x40
LCD.SETDDRAMADDR = 0x80

// flags for display entry mode
LCD.ENTRYRIGHT = 0x00
LCD.ENTRYLEFT = 0x02
LCD.ENTRYSHIFTINCREMENT = 0x01
LCD.ENTRYSHIFTDECREMENT = 0x00

// flags for display on/off control
LCD.DISPLAYON = 0x04
LCD.DISPLAYOFF = 0x00
LCD.CURSORON = 0x02
LCD.CURSOROFF = 0x00
LCD.BLINKON = 0x01
LCD.BLINKOFF = 0x00

// flags for display/cursor shift
LCD.DISPLAYMOVE = 0x08
LCD.CURSORMOVE = 0x00
LCD.MOVERIGHT = 0x04
LCD.MOVELEFT = 0x00

// flags for function set
// Intentionally sparse array
LCD.BITMODE = [ , , , , 0x00, , , , 0x10 ];
// 4 & 8

// Intentionally sparse array
LCD.LINE = [ , 0x00, 0x08 ];
// 1 & 2

LCD.DOTS = {
  "5x10": 0x04,
  "5x8": 0x00
};

// flags for backlight control
LCD.BACKLIGHT = {
  ON: 0x08,
  OFF: 0x00
};



module.exports = LCD;






// http://www.arduino.cc/playground/Code/LCDAPI
