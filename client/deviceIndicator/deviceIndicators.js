Template.deviceIndicators.rendered = function() {
  $(document).ready(function() {
    // $("#deviceIndicatorWrapper").width($("#deviceIndicatorWrapper").width());
    // $("#deviceIndicatorWrapper").height($("#deviceIndicatorWrapper").height());
  });
};

Template.deviceIndicators.borderCSS = function() {
  var thisDevice = Session.get('thisDevice');
  if (thisDevice === undefined || !thisDevice.id) return;

  var colorDeg = window.getDeviceColorDeg(thisDevice.id);
  // var info = DeviceInfo.findOne({ _id: thisDevice.id });
  // if (info === undefined || info.colorDeg === undefined) return;

  var color = window.degreesToColor(colorDeg);

  // return 'border-color: rgb('+color.r+', '+color.g+', '+color.b+')';
  return 'border-image: radial-gradient(rgb('+color.r+', '+color.g+', '+color.b+') 25%, rgba('+color.r+', '+color.g+', '+color.b+', 0.5) 100%, rgba('+color.r+', '+color.g+', '+color.b+', 0.5)) 1%;';
};

Template.deviceIndicators.deviceBackgroundColorCSS = function() {
  var colorDeg = window.getDeviceColorDeg(this.id);
  // var info = DeviceInfo.findOne({ _id: this.id });
  // if (info === undefined || !info.colorDeg) return "";

  var color = window.degreesToColor(colorDeg);

  return 'background-color: rgb('+color.r+', '+color.g+', '+color.b+');';
};

var degreesToRadians = function(degrees) {
  var radians = degrees * Math.PI / 180;
  return radians;
}

Template.deviceIndicators.deviceSizeAndPositionCSS = function() {
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
    var angle = otherDevice.angle % 360;

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
};

Template.deviceIndicators.otherDevices = function() {
  return Session.get("otherDevices") || [];
};

Template.deviceIndicators.events({
  'touchstart .deviceIndicator, mouseover .deviceIndicator': function(e) {
    // Template.deviceIndicators.highlightIndicator(e.currentTarget);
  },

  'touchend .deviceIndicator, mouseup .deviceIndicator': function(e) {
    e.preventDefault();
    Template.deviceIndicators.sendThroughIndicator(e.currentTarget);
  }
});

//
// "PUBLIC" API
//

Template.deviceIndicators.highlightIndicator = function(indicator) {
  $(indicator).css('transform', 'scale(1.25, 1.25)');
};

Template.deviceIndicators.unhighlightIndicator = function(indicator) {
  $(indicator).css('transform', '');
};

Template.deviceIndicators.sendThroughIndicator = function(indicator, text, sourcedocID) {
  var targetID = $(indicator).attr("deviceid");
  if (targetID === undefined) return;

  if (text === undefined) {
    text = Template.detailDocumentTemplate.currentlySelectedContent();
  }

  //If no source document for the send is provided, we assume that a detial document is open and is
  //the source
  if (sourcedocID === undefined) {
    var doc = Session.get("detailDocument");
    if (doc !== undefined) sourcedocID = doc._id;
  }

  if (text !== undefined && text.length > 0) {
    //If a text selection exists, send it
    huddle.broadcast("addtextsnippet", { target: targetID, doc: sourcedocID, snippet: text } );
    pulseIndicator(indicator);
    showSendConfirmation(indicator, "The selected text was sent to the device.");

    var thisDevice = Session.get('thisDevice');
    var actionSource = (Router.current().route.name === "searchIndex") ? "detailDocument" : "snippets";
    Logs.insert({
      timestamp      : Date.now(),
      route          : Router.current().route.name,
      deviceID       : thisDevice.id,
      actionType     : "shareSnippet",
      actionSource   : actionSource,
      actionSubsource: "deviceIndicator",
      targetDeviceID : targetID,
      documentID     : sourcedocID,
      snippet        : text,
    });
  } else {
    //If no selection was made but a document is open, send that

    if (doc !== undefined) {
      huddle.broadcast("showdocument", { target: targetID, documentID: sourcedocID } );
      pulseIndicator(indicator);
      showSendConfirmation(indicator, "The document "+sourcedocID+" is displayed on the device.");

      var thisDevice = Session.get('thisDevice');
      Logs.insert({
        timestamp      : Date.now(),
        route          : Router.current().route.name,
        deviceID       : thisDevice.id,
        actionType     : "shareDocument",
        actionSource   : "detailDocument", //must be, only source for shareDocument
        actionSubsource: "deviceIndicator",
        targetDeviceID : targetID,
        documentID     : sourcedocID,
      });
    } else {
      //If no document is open but a query result is shown, send that
      var lastQuery = Session.get('lastQuery');
      var lastQueryPage = Session.get('lastQueryPage');
      var route = Router.current().route.name;
      if (lastQuery !== undefined && route === "searchIndex") {
        huddle.broadcast("go", {
          target: targetID,
          template: "searchIndex",
          params: {
            _query: lastQuery,
            _page: lastQueryPage
          }
        });
        pulseIndicator(indicator);
        showSendConfirmation(indicator, "Search results were sent to the device.");

        console.log(Router.current());
        var thisDevice = Session.get('thisDevice');
        Logs.insert({
          timestamp      : Date.now(),
          route          : Router.current().route.name,
          deviceID       : thisDevice.id,
          actionType     : "shareResults",
          actionSource   : "search", //must be
          actionSource   : "deviceIndicator",
          targetDeviceID : targetID,
          query          : lastQuery,
          page           : lastQueryPage
        });
      }
    }
  }
};

//
// ANIMATION STUFF
//
function pulseIndicator(indicator) {
  $(indicator).css('transform', 'scale(1.5, 1.5)');
  Meteor.setTimeout(function() {
    $(indicator).css('transform', '');
  }, 300);
}

function showSendConfirmation(indicator, text) {
  $("#deviceIndicatorSendText").text(text);

  Meteor.setTimeout(function() {
    var eWidth = $("#deviceIndicatorSendText").width() + parseInt($("#deviceIndicatorSendText").css('padding-left')) + parseInt($("#deviceIndicatorSendText").css('padding-right'));
    var eHeight = $("#deviceIndicatorSendText").height() + parseInt($("#deviceIndicatorSendText").css('padding-top')) + parseInt($("#deviceIndicatorSendText").css('padding-bottom'));
    var indicatorSize = $(indicator).width();

    $("#deviceIndicatorSendText").css({ top: "auto", left: "auto", right: "auto", bottom: "auto"});

    var css = { opacity: 1.0 };
    if ($(indicator).css('top') !== 'auto') {
      css.top = parseInt($(indicator).css('top')) + indicatorSize/2.0 - eHeight/2.0;
      if (css.top < 100) css.top = indicatorSize/2.0 + 20;
      css.top += "px";
    }
    if ($(indicator).css('left') !== 'auto') {
      css.left = parseInt($(indicator).css('left')) + indicatorSize/2.0 - eWidth/2.0;
      if (css.left < 100) css.left = indicatorSize/2.0 + 20;
      css.left += "px";
    }
    if ($(indicator).css('right') !== 'auto') {
      css.right = parseInt($(indicator).css('right')) - indicatorSize/2.0 + eWidth/2.0;
      if (css.right < 100) css.right = indicatorSize/2.0 + 20;
      css.right += "px";
    }
    if ($(indicator).css('bottom') !== 'auto') {
      css.bottom = parseInt($(indicator).css('bottom')) - indicatorSize/2.0 + eHeight/2.0;
      if (css.bottom < 100) css.bottom = indicatorSize/2.0 + 20;
      css.bottom += "px";
    }

    $("#deviceIndicatorSendText").css(css);

    Meteor.setTimeout(function() {
      $("#deviceIndicatorSendText").css("opacity", 0);
    }, 2000);
  }, 1);
}
