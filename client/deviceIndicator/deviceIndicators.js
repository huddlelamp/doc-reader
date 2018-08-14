import { default as App } from '../app';

Template.deviceIndicators.onRendered(function () {
  $(document).ready(function () {
    // $("#deviceIndicatorWrapper").width($("#deviceIndicatorWrapper").width());
    // $("#deviceIndicatorWrapper").height($("#deviceIndicatorWrapper").height());
  });
});

Template.deviceIndicators.helpers({
  borderCSS: function () {
    var thisDevice = Session.get('thisDevice');
    if (thisDevice === undefined || !thisDevice.id) return;

    var colorDeg = window.getDeviceColorDeg(thisDevice.id);
    // var info = DeviceInfo.findOne({ _id: thisDevice.id });
    // if (info === undefined || info.colorDeg === undefined) return;

    var color = window.degreesToColor(colorDeg);

    // return 'border-color: rgb('+color.r+', '+color.g+', '+color.b+')';
    return 'border-image: radial-gradient(rgb(' + color.r + ', ' + color.g + ', ' + color.b + ') 25%, rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0.5) 100%, rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0.5)) 1%;';
  },

  deviceBackgroundColorCSS: function () {
    var colorDeg = window.getDeviceColorDeg(this.id);
    // var info = DeviceInfo.findOne({ _id: this.id });
    // if (info === undefined || !info.colorDeg) return "";

    var color = window.degreesToColor(colorDeg);

    return 'background-color: rgb(' + color.r + ', ' + color.g + ', ' + color.b + ');';
  },

  deviceSizeAndPositionCSS: function () {
    var thisDevice = Session.get('thisDevice');
    var otherDevice = this;

    //Figure out the final x/y coordinates of the device indicator
    //This is done by using the boundary intersection that is closest and valid
    //Then, one coordinate will be converted from world coords into device pixels
    //The other coordinate is simply set so that half the indicator is visible,
    //which gives us a nice half-circle
    //Furthermore, we calculate the indicator size based on the distance
    var MIN_INDICATOR_SIZE = 100;
    var CLOSENESS_INDICATOR_EXPAND = 50;
    var top;
    var right;
    var bottom;
    var left;
    var indicatorSize = MIN_INDICATOR_SIZE;

    var width = $(window).width();
    var height = $(window).height();
    var angle = (otherDevice.angle % 360) + 90;

    var w2 = width / 2;
    var h2 = height / 2;

    var x = 0;
    var y = 0;

    // quadrant I
    if (angle > 0 && angle < 90) {
      var radians = degreesToRadians(angle);
      var val = Math.tan(radians) * h2;

      if (val <= w2) {
        x = w2 + val;
        y = 0;
      }
      else {
        radians = degreesToRadians(90 - angle);
        val = Math.tan(radians) * w2;

        x = width;
        y = h2 - val;
      }
    }
    // quadrant II
    else if (angle > 90 && angle < 180) {
      angle = angle % 90;

      var radians = degreesToRadians(angle);
      var val = Math.tan(radians) * w2;

      if (val <= h2) {
        x = width;
        y = h2 + val;
      }
      else {
        radians = degreesToRadians(90 - angle);
        val = Math.tan(radians) * h2;

        x = w2 + val;
        y = height;
      }
    }
    // quadrant III
    else if (angle > 180 && angle < 270) {
      angle = angle % 90;

      var radians = degreesToRadians(angle);
      var val = Math.tan(radians) * h2;

      if (val <= w2) {
        x = w2 - val;
        y = height;
      }
      else {
        radians = degreesToRadians(90 - angle);
        val = Math.tan(radians) * w2;

        x = 0;
        y = h2 + val;
      }
    }
    // quadrant IV
    else if (angle > 270 && angle < 360) {
      angle = angle % 90;

      var radians = degreesToRadians(angle);
      var val = Math.tan(radians) * w2;

      if (val <= h2) {
        x = 0;
        y = h2 - val;
      }
      else {
        radians = degreesToRadians(90 - angle);
        val = Math.tan(radians) * h2;

        x = w2 - val;
        y = 0;
      }
    }

    var css = 'width: ' + indicatorSize + 'px; height: ' + indicatorSize + 'px; ';
    css += 'top: ' + y + 'px; ';
    css += 'left: ' + x + 'px; ';
    css += 'margin-top: -' + (indicatorSize / 2) + 'px; ';
    css += 'margin-left: -' + (indicatorSize / 2) + 'px;';

    return css;
  },

  otherDevices: function () {
    return Session.get("otherDevices") || [];
  }
});

var degreesToRadians = function (degrees) {
  var radians = degrees * Math.PI / 180;
  return radians;
}

Template.deviceIndicators.events({
  'pointerdown .deviceIndicator': function (e) {
    // App.deviceIndicators.highlightIndicator(e.currentTarget);
  },

  'pointerup .deviceIndicator': function (e) {
    e.preventDefault();
    App.deviceIndicators.sendThroughIndicator(e.currentTarget);
  }
});