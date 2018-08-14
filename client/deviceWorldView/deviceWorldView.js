import { default as App } from '../app';

Template.deviceWorldView.onRendered(function () {
  $("#openWorldView").popover({
    trigger: "manual",
    placement: "top",
    content: $("#worldViewWrapper"),
    container: "body",
    html: true,
  });//
});

Template.deviceWorldView.helpers({
  deviceBorderColorCSS: function () {
    var colorDeg = window.getDeviceColorDeg(this.id);
    // var info = DeviceInfo.findOne({ _id: this.id });
    // if (info === undefined || !info.colorDeg) return "";

    var color = window.degreesToColor(colorDeg);

    return 'border-color: rgb(' + color.r + ', ' + color.g + ', ' + color.b + ');';
  },

  deviceBackgroundColorCSS: function () {
    var colorDeg = window.getDeviceColorDeg(this.id);
    // var info = DeviceInfo.findOne({ _id: this.id });
    // if (info === undefined || !info.colorDeg) return "";

    var thisDevice = Session.get('thisDevice');

    var color = window.degreesToColor(colorDeg);

    alpha = 0.35;
    if (this.id === thisDevice.id) alpha = 0.1;
    return 'background-color: rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + alpha + ');';
  },

  deviceSizeAndPosition: function () {
    // var width  = $("#worldViewWrapper").width() / this.ratio.x;
    // var height = $("#worldViewWrapper").height() / this.ratio.y;
    // var x      = ($("#worldViewWrapper").width()) * this.topLeft.x;
    // var y      = ($("#worldViewWrapper").height()) * this.topLeft.y;

    var width = (1 / this.ratio.x) * 100.0;
    var height = (1 / this.ratio.y) * 100.0;
    var x = this.topLeft.x * 100.0;
    var y = this.topLeft.y * 100.0;

    return 'width: ' + width + '%; height: ' + height + '%; top: ' + y + '%; left: ' + x + '%;';
  },

  thisDevice: function () {
    return Session.get("thisDevice") || undefined;
  },

  otherDevices: function () {
    return Session.get("otherDevices") || [];
  }
});

Template.deviceWorldView.events({
  'pointerup #openWorldView': function () {
    Session.set("worldViewSnippetToSend", App.detailDocument.currentlySelectedContent());
  },

  'click #openWorldView': function (e) {
    App.deviceWorldView.show();
  },
});

function pulseDevice(device) {
  $(device).css('transform', 'scale(1.5, 1.5)');
  Meteor.setTimeout(function () {
    $(device).css('transform', '');
  }, 300);
}

function showSendConfirmation(device, text) {
  $("#worldViewSendText").text(text);

  Meteor.setTimeout(function () {
    // var eWidth = $("#worldViewSendText").width() + parseInt($("#worldViewSendText").css('padding-left')) + parseInt($("#worldViewSendText").css('padding-right'));
    // var eHeight = $("#worldViewSendText").height() + parseInt($("#worldViewSendText").css('padding-top')) + parseInt($("#worldViewSendText").css('padding-bottom'));

    // var deviceWidth = $(device).width();
    // var deviceHeight = $(device).height();

    // var top = parseInt($(device).position().top + deviceHeight/2.0) - eHeight/2.0;
    // var left = parseInt($(device).position().left + deviceWidth/2.0) - eWidth/2.0;

    var top = $(document).height() / 2.0;
    var left = $(document).width() / 2.0;
    $("#worldViewSendText").css({
      opacity: 1.0,
      position: "absolute",
      // top: top, 
      // left: left
      bottom: 100,
      right: 50
    });

    Meteor.setTimeout(function () {
      $("#worldViewSendText").css("opacity", 0);
    }, 2000);
  }, 1);
}