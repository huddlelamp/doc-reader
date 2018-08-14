const App = {
    deviceIndicators: {},
    deviceWorldView: {},
    detailDocument: {}
};

Object.defineProperties(App, {
    otherDevices: {
        get() {
            return Session.get("otherDevices") || [];
        }
    }
});

App.detailDocument.currentlySelectedContent = function () {
    var selection = getContentSelection();
    if (selection === undefined) return "";
    return $("#content").text().slice(selection[0], selection[1]);
};


///////////////
// SELECTION //
///////////////

var getContentSelection = function () {
    var selection = rangy.getSelection(0);

    if (selection.rangeCount === 0 || selection.isCollapsed) {
        return undefined;
    } else {
        var range = selection.getRangeAt(0);
        var relativeRange = selectionRelativeTo(range, $("#content"));

        return relativeRange;
    }
};


var selectionRelativeTo = function (selection, elem) {
    //The selection is relative to a childnode of elem (at least it should be)
    //Therefore, we count the length of every child of elem until we arrive at the
    //start/endnode of the selection.
    var startOffset = 0;
    var endOffset = 0;
    var currentOffset = 0;
    var doneStart = false;
    var doneEnd = false;

    var countRecursive = function () {
        if (this.isSameNode(selection.startContainer)) {
            startOffset = currentOffset + selection.startOffset;
            doneStart = true;
        }

        if (this.isSameNode(selection.endContainer)) {
            endOffset = currentOffset + selection.endOffset;
            doneEnd = true;
        }

        if (doneStart && doneEnd) return;

        if (this.nodeType === 3) currentOffset += this.length;
        else $(this).contents().each(countRecursive);
    };

    //Start the recursion
    $(elem).contents().each(countRecursive);

    //If we didn't find the start or endnode they are not children of elem
    if (doneStart === false || doneEnd === false) return undefined;

    //If the selection is made backwards, the offset might be swapped
    if (startOffset > endOffset) {
        var temp = startOffset;
        startOffset = endOffset;
        endOffset = temp;
    }

    return [startOffset, endOffset];
};

var rangeIntersection = function (s1, e1, s2, e2) {
    if (s2 <= s1 && e2 >= s1) {
        if (e2 > e1) return [s1, e1];
        return [s1, e2];
    }

    if (s1 <= s2 && e1 >= s2) {
        if (e1 > e2) return [s2, e2];
        return [s2, e1];
    }

    return undefined;
};

//
// SELECTION AND HIGHLIGHTS
// 

var countSelectedHighlights = function (selection) {
    if (selection === undefined) selection = getContentSelection();
    if (selection === undefined) return 0;

    var startOffset = selection[0];
    var endOffset = selection[1];

    //Walk over all highlights, check if they intersect the current selection
    //If they do, they are not taken into newHighlights
    var doc = Session.get("detailDocument");
    var meta = DocumentMeta.findOne({ _id: doc._id });
    var count = 0;
    if (meta && meta.textHighlights) {
        for (var i = 0; i < meta.textHighlights.length; i++) {
            var highlight = meta.textHighlights[i];
            var intersection = rangeIntersection(startOffset, endOffset, highlight[0], highlight[1]);
            if (intersection !== undefined) {
                count++;
            }
        }
    }

    return count;
};

var deleteSelectedHighlights = function (selection) {
    if (selection === undefined) selection = getContentSelection();
    if (selection === undefined || selection.length < 1) return false;

    var startOffset = selection[0];
    var endOffset = selection[1];

    //Walk over all highlights, check if they intersect the current selection
    //If they do, they are not taken into newHighlights
    var doc = Session.get("detailDocument");
    var meta = DocumentMeta.findOne({ _id: doc._id });
    var newHighlights = [];
    var deletedHighlights = [];
    if (meta && meta.textHighlights) {
        for (var i = 0; i < meta.textHighlights.length; i++) {
            var highlight = meta.textHighlights[i];
            var intersection = rangeIntersection(startOffset, endOffset, highlight[0], highlight[1]);
            if (intersection === undefined) {
                newHighlights.push(meta.textHighlights[i]);
            } else {
                deletedHighlights.push(meta.textHighlights[i]);
            }
        }
    }

    //Insert the "surviving" highlights back into the DB
    DocumentMeta._upsert(doc._id, { $set: { textHighlights: newHighlights } });

    var thisDevice = Session.get('thisDevice');
    Logs.insert({
        timestamp: Date.now(),
        route: Router.current().route.name,
        deviceID: thisDevice.id,
        actionType: "deletedDocumentHighlights",
        actionSource: "documentDetails",
        documentID: doc._id,
        deletedHighlights: deletedHighlights,
        documentHighlights: newHighlights
    });
};


//////////
// MISC //
//////////


var hidePopoverTimer;
var showPopover = function (target, content, options) {
    var defaultOptions = {
        placement: "bottom",
        container: false,
        trigger: "manual",
        autoHide: 0
    };
    options = $.extend(defaultOptions, options);

    if (hidePopoverTimer !== undefined) {
        Meteor.clearTimeout(hidePopoverTimer);
        hidePopoverTimer = undefined;
    }

    $(target).popover('destroy');
    $(target).popover({
        trigger: options.trigger,
        placement: options.placement,
        content: content,
        container: options.container,
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
            var popover = $("#" + $(target).attr("aria-describedby"));
            if (popover.length > 0 && $.contains(popover[0], e.target)) {
                return;
            }

            hidePopover(target);
            $("body").off('pointerdown');
        });
    }, 1);

    $(target).popover('show');

    if (options.autoHide > 0) {
        hidePopoverTimer = Meteor.setTimeout(function () {
            hidePopover(target);
        }, options.autoHide);
    }
};

var hidePopover = function (target) {
    $(target).popover('hide');
};

/** Encodes file content for displaying **/
var encodeContent = function (text) {
    // return text.replace(/\n\s*/g, "\n");
    return text;
    // var pre = $("<pre></pre>");
    // pre.html(text);
    // pre.html(pre.html().replace(/&nbsp;/g, " "));
    // return pre.html();
};

window.UIMenuController = {};
window.UIMenuController.menuItems = [
    {
        title: "Share",
        action: function () {
            //For some reason, not deferring this code might make it hang on the
            //second execute :/
            Meteor.setTimeout(function () {
                var menuFrame = window.UIMenuController.menuFrame();

                $("#sharePopupAnchor").css({
                    position: "absolute",
                    top: menuFrame.y + menuFrame.height,
                    left: menuFrame.x + menuFrame.width / 2.0
                });

                showSharePopup($("#sharePopupAnchor"), "popout");
            }, 1);
        },
        canPerform: function () {
            var selection = getContentSelection();
            if (selection !== undefined || selection.length > 0) return true;

            return false;
        }
    },
    {
        title: "Delete Highlights",
        action: deleteSelectedHighlights,
        canPerform: function () { return (countSelectedHighlights() > 0); }
    }
];

//
// "PUBLIC" API
//

App.deviceIndicators.highlightIndicator = function (indicator) {
    $(indicator).css('transform', 'scale(1.25, 1.25)');
};

App.deviceIndicators.unhighlightIndicator = function (indicator) {
    $(indicator).css('transform', '');
};

App.deviceIndicators.sendThroughIndicator = function (indicator, text, sourcedocID) {
    var targetID = $(indicator).attr("deviceid");
    if (targetID === undefined) return;

    if (text === undefined) {
        text = App.detailDocument.currentlySelectedContent();
    }

    //If no source document for the send is provided, we assume that a detial document is open and is
    //the source
    if (sourcedocID === undefined) {
        var doc = Session.get("detailDocument");
        if (doc !== undefined) sourcedocID = doc._id;
    }

    if (text !== undefined && text.length > 0) {
        //If a text selection exists, send it
        huddle.broadcast("addtextsnippet", { target: targetID, doc: sourcedocID, snippet: text });
        pulseIndicator(indicator);
        showSendConfirmation(indicator, "The selected text was sent to the device.");

        var thisDevice = Session.get('thisDevice');
        var actionSource = (Router.current().route.name === "searchIndex") ? "detailDocument" : "snippets";
        Logs.insert({
            timestamp: Date.now(),
            route: Router.current().route.name,
            deviceID: thisDevice.id,
            actionType: "shareSnippet",
            actionSource: actionSource,
            actionSubsource: "deviceIndicator",
            targetDeviceID: targetID,
            documentID: sourcedocID,
            snippet: text,
        });
    } else {
        //If no selection was made but a document is open, send that

        if (doc !== undefined) {
            huddle.broadcast("showdocument", { target: targetID, documentID: sourcedocID });
            pulseIndicator(indicator);
            showSendConfirmation(indicator, "The document " + sourcedocID + " is displayed on the device.");

            var thisDevice = Session.get('thisDevice');
            Logs.insert({
                timestamp: Date.now(),
                route: Router.current().route.name,
                deviceID: thisDevice.id,
                actionType: "shareDocument",
                actionSource: "detailDocument", //must be, only source for shareDocument
                actionSubsource: "deviceIndicator",
                targetDeviceID: targetID,
                documentID: sourcedocID,
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
                    timestamp: Date.now(),
                    route: Router.current().route.name,
                    deviceID: thisDevice.id,
                    actionType: "shareResults",
                    actionSource: "search", //must be
                    actionSource: "deviceIndicator",
                    targetDeviceID: targetID,
                    query: lastQuery,
                    page: lastQueryPage
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
    Meteor.setTimeout(function () {
        $(indicator).css('transform', '');
    }, 300);
}

function showSendConfirmation(indicator, text) {
    $("#deviceIndicatorSendText").text(text);

    Meteor.setTimeout(function () {
        var eWidth = $("#deviceIndicatorSendText").width() + parseInt($("#deviceIndicatorSendText").css('padding-left')) + parseInt($("#deviceIndicatorSendText").css('padding-right'));
        var eHeight = $("#deviceIndicatorSendText").height() + parseInt($("#deviceIndicatorSendText").css('padding-top')) + parseInt($("#deviceIndicatorSendText").css('padding-bottom'));
        var indicatorSize = $(indicator).width();

        $("#deviceIndicatorSendText").css({ top: "auto", left: "auto", right: "auto", bottom: "auto" });

        var css = { opacity: 1.0 };
        if ($(indicator).css('top') !== 'auto') {
            css.top = parseInt($(indicator).css('top')) + indicatorSize / 2.0 - eHeight / 2.0;
            if (css.top < 100) css.top = indicatorSize / 2.0 + 20;
            css.top += "px";
        }
        if ($(indicator).css('left') !== 'auto') {
            css.left = parseInt($(indicator).css('left')) + indicatorSize / 2.0 - eWidth / 2.0;
            if (css.left < 100) css.left = indicatorSize / 2.0 + 20;
            css.left += "px";
        }
        if ($(indicator).css('right') !== 'auto') {
            css.right = parseInt($(indicator).css('right')) - indicatorSize / 2.0 + eWidth / 2.0;
            if (css.right < 100) css.right = indicatorSize / 2.0 + 20;
            css.right += "px";
        }
        if ($(indicator).css('bottom') !== 'auto') {
            css.bottom = parseInt($(indicator).css('bottom')) - indicatorSize / 2.0 + eHeight / 2.0;
            if (css.bottom < 100) css.bottom = indicatorSize / 2.0 + 20;
            css.bottom += "px";
        }

        $("#deviceIndicatorSendText").css(css);

        Meteor.setTimeout(function () {
            $("#deviceIndicatorSendText").css("opacity", 0);
        }, 2000);
    }, 1);
}


//
// "PUBLIC" METHODS
//

App.deviceWorldView.show = function () {
    $("#worldViewWrapper").css("display", "block");
    $("#openWorldView").popover("show");

    //Remove padding from this popup, we don't want it
    Meteor.setTimeout(function () {
        var popover = $("#" + $("#openWorldView").attr("aria-describedby") + " .popover-content");
        popover.css('padding', 0);
    }, 1);

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
            var popover = $("#" + $("#openWorldView").attr("aria-describedby"));
            if (popover.length > 0 && $.contains(popover[0], e.target)) {
                return;
            }

            App.deviceWorldView.hide();
        });
    }, 1);

    $(".worldDevice").off("click");
    $(".worldDevice").on('click', function (e) {
        var targetID = $(this).attr("deviceid");
        if (targetID === undefined) return;

        var text = Session.get("worldViewSnippetToSend");
        var sourcedocID = Session.get("worldViewSnippetDoc");

        var doc = Session.get("detailDocument");
        if (sourcedocID === undefined) {
            if (doc !== undefined) sourcedocID = doc._id;
        }
        if (text !== undefined && text.length > 0 && sourcedocID !== undefined) {
            //If a text selection exists, send it
            huddle.broadcast("addtextsnippet", { target: targetID, doc: sourcedocID, snippet: text });
            // pulseDevice(this);
            showSendConfirmation($("#openWorldView"), "The selected text was sent to the device.");

            var thisDevice = Session.get('thisDevice');
            var actionSource = (Router.current().route.name === "searchIndex") ? "detailDocument" : "snippets";
            Logs.insert({
                timestamp: Date.now(),
                route: Router.current().route.name,
                deviceID: thisDevice.id,
                actionType: "shareSnippet",
                actionSource: actionSource, //must be, only source for sharesnippet
                actionSubsource: "worldView",
                targetDeviceID: targetID,
                documentID: sourcedocID,
                snippet: text,
            });

            var remove = Session.get("worldViewSnippetRemove");
            if (remove !== undefined && remove !== false) {
                Snippets.remove({ _id: remove });
            }
            Session.set("worldViewSnippetRemove", undefined);
            Session.set("worldViewSnippetDoc", undefined);
        } else {
            //If no selection was made but a document is open, send that
            if (doc !== undefined) {
                huddle.broadcast("showdocument", { target: targetID, documentID: doc._id });
                // pulseDevice(this);
                showSendConfirmation($("#openWorldView"), "The document " + doc._id + " is displayed on the device.");

                var thisDevice = Session.get('thisDevice');
                Logs.insert({
                    timestamp: Date.now(),
                    route: Router.current().route.name,
                    deviceID: thisDevice.id,
                    actionType: "shareDocument",
                    actionSource: "detailDocument",
                    actionSubsource: "worldView",
                    targetDeviceID: targetID,
                    documentID: doc._id
                });
            } else {
                //If no document is open but a query result is shown, send that
                var lastQuery = Session.get('lastQuery');
                var lastQueryPage = Session.get('lastQueryPage');
                var route = Router.current().route.name;
                if (lastQuery !== undefined && route === "searchIndex") {
                    // huddle.broadcast("dosearch", {target: targetID, query: lastQuery, page: lastQueryPage });
                    // pulseDevice(this);
                    // 
                    huddle.broadcast("go", {
                        target: targetID,
                        template: "searchIndex",
                        params: {
                            _query: lastQuery,
                            _page: lastQueryPage
                        }
                    });
                    showSendConfirmation($("#openWorldView"), "Search results were sent to the device.");

                    var thisDevice = Session.get('thisDevice');
                    Logs.insert({
                        timestamp: Date.now(),
                        route: Router.current().route.name,
                        deviceID: thisDevice.id,
                        actionType: "shareResults",
                        actionSource: "search",
                        actionSubsource: "worldView",
                        targetDeviceID: targetID,
                        query: lastQuery,
                        page: lastQueryPage
                    });
                }
            }
        }

        App.deviceWorldView.hide();
    });
};

App.deviceWorldView.hide = function () {
    $("body").off('pointerdown');
    $("#worldViewWrapper").css("display", "none").appendTo("body");
    $("#openWorldView").popover("hide");
};

export default App;
