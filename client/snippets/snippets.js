import Hammer from 'hammerjs';

import { default as App } from '../app';

const updatePosition = (id, x, y) => {
  Snippets.update(
    { _id: id },
    {
      $set: {
        x: x,
        y: y
      }
    }
  );
}

Template.snippet.onRendered(function () {
  const element = this.firstNode;
  const data = this.data;

  const computedStyle = window.getComputedStyle(element);
  const width = parseInt(computedStyle.width);
  const height = parseInt(computedStyle.height);

  let x = data.x;
  let y = data.y;
  // check for typeof because 0px position are valid, but would
  // be true if check is if (!top) { ... }
  if (typeof x === 'undefined') {
    x = getRandomInt(0, window.innerWidth - width);
  }
  if (typeof y === 'undefined') {
    y = getRandomInt(0, window.innerHeight - height);
  }

  updatePosition(data._id, x, y);

  // initialize hammer if it doesn't exist yet
  if (!element.__hammer) {
    const hammerTime = element.__hammer = new Hammer(element);

    let x;
    let y;
    hammerTime.on('panstart', function (event) {
      x = parseInt(element.style.left);
      y = parseInt(element.style.top);
    });

    hammerTime.on('panmove', function (event) {
      const newX = x + event.deltaX;
      const newY = y + event.deltaY;
      updatePosition(data._id, newX, newY);
    });

    hammerTime.on('panend', function (event) {
      console.log('event', event, event.srcEvent.currentTarget);

      const element = document.elementFromPoint(event.center.x, event.center.y);
      console.log(element);

      if (element.classList.contains("deviceIndicator")) {
        App.deviceIndicators.sendThroughIndicator(element, data.text, data.sourcedoc);
        Snippets.remove({ _id: data._id });
      }
    });
  }
});

Template.snippet.onDestroyed(function () {
  // // This does not work because firstNode doesn't exist anymore at this point
  // const element = this.firstNode;
  // if (element.__hammer) {
  //   element.__hammer.destroy();
  // }
});

Template.snippet.events({
  'pointerdown .snippet': function (e) {
    if (frontSnippet !== undefined) frontSnippet.css({ 'z-index': '' });

    var snippetID = this._id;
    frontSnippet = $("#snippet_" + snippetID);
    frontSnippet.css({ 'z-index': 7011 });
  },

  'pointerup .snippetsharer': function (e) {
    showSharePopup(e.target, this);
  },

  'pointerup .snippetdeleter': function (e) {
    var snippetID = this._id;
    $(e.target).hide();
    $("#snippet_" + snippetID + " .snippetdeleterconfirmation").show({ duration: 400 });
  },

  'pointerup .snippetdeleterconfirmation .btn-danger': function (e) {
    Snippets.remove({ _id: this._id });

    var thisDevice = Session.get('thisDevice');
    Logs.insert({
      timestamp: Date.now(),
      route: Router.current().route.name,
      deviceID: thisDevice.id,
      actionType: "deleteSnippet",
      actionSource: "snippets",
      actionSubsource: "button",
      snippetID: this._id
    });
  },

  'pointerup .snippetdeleterconfirmation .btn-cancel': function (e) {
    var snippetID = this._id;
    $("#snippet_" + snippetID + " .snippetdeleterconfirmation").hide({
      duration: 400,
      complete: function () {
        $("#snippet_" + snippetID + " .snippetdeleter").show();
      }
    });
  }
})

Template.snippets.helpers({
  snippets: function () {
    var thisDevice = Session.get('thisDevice');
    if (thisDevice === undefined) return [];

    var snippets = Snippets.find({ device: thisDevice.id });
    return snippets.fetch();
  },

  otherDevices: function () {
    return Session.get("otherDevices") || [];
  }
});

var frontSnippet;
var dragLastPoint;
var draggedSnippet;
var highlightedIndicator;
Template.snippets.events({
  'click .add-dummy-snippet'(e) {
    console.log('click here');

    Snippets.insert({
      device: Session.get("thisDevice").id,
      sourcedoc: undefined,
      text: "Hello World"
    });
  },

  'pointerenter .deviceIndicator': function (e) {
    App.deviceIndicators.highlightIndicator(e.currentTarget);
  },

  'pointerout .deviceIndicator': function (e) {
    App.deviceIndicators.unhighlightIndicator(e.currentTarget);
  },
});

Template.snippets.helpers({
  'thisDeviceBorderColorCSS': function () {
    return window.thisDeviceBorderColorCSS();
  },

  'deviceColorCSS': function () {
    return 'background-color: ' + window.deviceColorCSS(this);
  },

  'deviceSizePositionCSS': function () {
    return window.deviceSizePositionCSS(this);
  },
});

var removeSnippet = function (snippetID) {
  Snippets.remove({ _id: snippetID });
};

var dirtyTimer = {};
function markSnippetDirty(snippet) {
  if (dirtyTimer[snippet._id] !== undefined) return;

  dirtyTimer[snippet._id] = Meteor.setTimeout(function () {
    dirtyTimer[snippet._id] = undefined;

    if ($("#snippet_" + snippet._id).length === 0 || $("#snippet_" + snippet._id).css("display") === "none") {
      return;
    }

    var y = parseInt($("#snippet_" + snippet._id).css('top'));
    var x = parseInt($("#snippet_" + snippet._id).css('left'));
    var existing = Snippets.findOne({ _id: snippet._id });

    if (existing.x === x && existing.y === y) return;

    Snippets.update(
      { _id: snippet._id },
      {
        $set: {
          y: y,
          x: x
        }
      }
    );

    var thisDevice = Session.get('thisDevice');
    Logs.insert({
      timestamp: Date.now(),
      route: Router.current().route.name,
      deviceID: thisDevice.id,
      actionType: "movedSnippet",
      snippetID: snippet._id,
      position: { x: x, y: y }
    });
  }, 2500);
}

var showSharePopup = function (el, snippet) {
  var otherDevices = App.otherDevices;
  var text = snippet.text;

  var content = $("<span>Send text snippet to:</span>");
  content.append("<br />");
  content.append("<br />");

  for (var i = 0; i < otherDevices.length; i++) {
    var device = otherDevices[i];
    var info = DeviceInfo.findOne({ _id: device.id });
    if (info === undefined || info.colorDeg === undefined) return;

    var color = new tinycolor(window.degreesToColor(info.colorDeg)).toRgbString();

    var link = $("<button />");
    link.attr("deviceid", device.id);
    link.addClass("btn shareDevice noDeviceCustomization popupClickable");
    link.css('border-color', color);

    link.on('click', function (e2) {
      var targetID = $(this).attr("deviceid");
      if (targetID === undefined) return;

      huddle.broadcast("addtextsnippet", { target: targetID, doc: snippet.sourcedoc, snippet: text });
      // pulseIndicator(e.currentTarget);
      // showSendConfirmation(e.currentTarget, "The selected text was sent to the device.");
      Snippets.remove({ _id: snippet._id });

      $(el).popover('hide');

      var thisDevice = Session.get('thisDevice');
      Logs.insert({
        timestamp: Date.now(),
        route: Router.current().route.name,
        deviceID: thisDevice.id,
        actionType: "shareSnippet",
        actionSource: "snippets",
        actionSubsource: "button",
        targetDeviceID: targetID,
        documentID: snippet.sourcedoc,
        snippet: text,
      });
      Logs.insert({
        timestamp: Date.now(),
        route: Router.current().route.name,
        deviceID: thisDevice.id,
        actionType: "deleteSnippet",
        actionSource: "snippets",
        actionSubsource: "share",
        snippetID: snippet._id
      });
    });
    content.append(link);
  }

  // showPopover(el, content, {placement: "top", container: "body"});

  $(el).popover('destroy');
  $(el).popover({
    trigger: "manual",
    placement: "top",
    content: content,
    container: "body",
    html: true,
  });

  //We want to close popups when the user clicks basically anywhere outside of them
  //If showPopup() is used in a click event handler, though, this would cause the
  //popup to close immediatly, therefore we setup the event handlers on body in the
  //next run loop
  Meteor.setTimeout(function () {
    $("body").off('pointerdown');
    $("body").on('pointerdown', function (e) {
      if ($(e.target).hasClass("popupClickable") === false) {
        e.preventDefault();
      }

      //Don't hide the popup if an element inside of it was touched
      var popover = $("#" + $(el).attr("aria-describedby"));
      if (popover.length > 0 && $.contains(popover[0], e.target)) {
        return;
      }

      $(el).popover('hide');
      $("body").off('pointerdown');
    });
  }, 1);

  $(el).popover('show');
};

function getEventLocation(e, type) {
  if (type === undefined) type = "page";

  var pos = { x: e[type + "X"], y: e[type + "Y"] };
  if (pos.x === undefined || pos.y === undefined) {
    pos = { x: e.originalEvent.targetTouches[0][type + "X"], y: e.originalEvent.targetTouches[0][type + "Y"] };
  }

  return pos;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
