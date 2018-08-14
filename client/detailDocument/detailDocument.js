import { default as App } from "../app";

var popupID = 0;
var lockPreviewSnippet = false;

var insertHighlightIntoText = function (text, highlight, start, end, cssClasses) {
  return [
    text.slice(0, start),
    '<span class="highlight ' + cssClasses + '" style="background-color: ' + highlight[2] + ';">',
    text.slice(start, end),
    '</span>',
    text.slice(end)
  ].join('');
};

var insertHighlightIntoDOM = function (elem, highlight, state) {
  if (elem === undefined || highlight === undefined) return;
  if (state === undefined) state = {};
  if (!state.offset) state.offset = 0;
  if (!state.opened) state.opened = false;
  if (!state.closed) state.closed = false;
  if (!state.cssClasses) state.cssClasses = "";

  if (state.closed) return state;

  var startOffset = highlight[0];
  var endOffset = highlight[1];

  if (elem.nodeType === 3) {
    state.offset += elem.length;

    if (!state.opened && state.offset > startOffset) {
      //CASE 1: This node contains the start of the highlight
      state.opened = true;

      //Highlight start is defined by startOffset, highlightEnd depends on
      //if the highlight ends in this node or goes beyond this node (in which 
      //case it might be continued in CASE 3 and will be closed in CASE 2)
      var highlightStart = startOffset - (state.offset - elem.length);
      var highlightEnd = elem.length;
      if (state.offset >= endOffset) {
        highlightEnd = endOffset - (state.offset - elem.length);
        state.closed = true;
      }

      $(elem).replaceWith(insertHighlightIntoText(
        $(elem).text(),
        highlight,
        highlightStart,
        highlightEnd,
        state.cssClasses
      ));
    } else {
      if (state.opened) {
        if (state.offset >= endOffset) {
          //CASE 2: End of highlight is in this node
          //Since the highlight started before this node, we highlight from the
          //beginning to endOffset
          var highlightStart = 0;
          var highlightEnd = endOffset - (state.offset - elem.length);

          $(elem).replaceWith(insertHighlightIntoText(
            $(elem).text(),
            highlight,
            highlightStart,
            highlightEnd,
            state.cssClasses
          ));

          state.closed = true;
        } else {
          //CASE 3: the entire node is part of the highlight, it doesn't end here
          //Therefore, the entire node needs to be highlighted
          $(elem).replaceWith(insertHighlightIntoText(
            $(elem).text(),
            highlight,
            0,
            elem.length,
            state.cssClasses
          ));
        }
      }
    }
  } else {
    //CASE 4: If this node is not a textnode, we go deeper
    $(elem).contents().each(function () { state = insertHighlightIntoDOM(this, highlight, state); });
  }

  return state;
};

var insertTextHighlights = function (textHighlights, docContent) {
  if (textHighlights !== undefined) {
    for (var i = 0; i < textHighlights.length; i++) {
      var highlight = textHighlights[i];
      var color = new tinycolor(highlight[2]);
      color = color.setAlpha(0.35).toRgbString();
      highlight[2] = color;
      insertHighlightIntoDOM(docContent, textHighlights[i]);
    }
  }
};

Template.detailDocumentTemplate.helpers({
  content: function () {
    return Session.get("content") || "";
  },

  contentEvent: function () {
    var doc = Session.get("detailDocument");
    if (doc === undefined) return undefined;

    var contentType = doc._source._content_type;
    var meta = DocumentMeta.findOne({ _id: this._id });
    if (contentType == "image/jpeg") {
      Session.set('content', '<img src="data:' + contentType + ';base64,' + doc._source.file + '" />')
    } else if (contentType == "application/vnd.ms-excel") {
      var that = this;
      Meteor.call("getOfficeContent", "excel", doc._source.file, function (err, data) {
        function getCellValue(cell) {
          if (data.Sheets[data.SheetNames[0]][cell] === undefined) return "";
          return data.Sheets[data.SheetNames[0]][cell].w;
        }

        function getCellType(cell) {
          if (data.Sheets[data.SheetNames[0]][cell] === undefined) return "s";
          return data.Sheets[data.SheetNames[0]][cell].t;
        }

        function getCellColumn(cell) {
          return cell.replace(/([A-Z]+)[0-9]+/ig, "$1");
        }

        function getCellRow(cell) {
          return cell.replace(/[A-Z]+([0-9]+)/ig, "$1");
        }

        function incrementColumn(column, pos) {
          if (pos === undefined) pos = column.length - 1;

          var theChar = column.substr(pos, 1);

          if (theChar == "Z") {
            if (pos === 0) {
              //The first character is a Z
              //We need to make every character an A and append an additional one
              var result = "A";
              for (var i = 0; i < column.length; i++) {
                result += "A";
              }
              return result;
            } else {
              //We reached a Z in the current position, make it an A and increment the position before it
              var newColumn = column.substr(0, pos) + "A" + column.substr(pos + 1);
              return incrementColumn(newColumn, pos - 1);
            }
          }
          else {
            //Replace the character at pos with the next character
            var nextChar = String.fromCharCode(theChar.charCodeAt(0) + 1);
            return column.substr(0, pos) + nextChar + column.substr(pos + 1);
          }
        }

        //Parse the excel data
        //First, get the smallest and largest field in the sheet
        var smallestRow = 1;
        var smallestColumn = "A";
        var largestField = data.Sheets[data.SheetNames[0]]["!ref"].split(":")[1];
        var largestRow = getCellRow(largestField);
        var largestColumn = getCellColumn(largestField);

        //Now, walk over every possible cell and print its value
        var content = $('<table></table>');
        content.addClass("excelsheet");

        //Create the column headings
        var headingRow = $("<tr></tr>");
        headingRow.append("<th></th>");
        for (var c = smallestColumn; c != incrementColumn(largestColumn); c = incrementColumn(c)) {
          headingRow.append("<th>" + c + "</th>");
        }
        content.append(headingRow);

        for (var r = smallestRow; r <= largestRow; r++) {
          var row = $("<tr></tr>");
          // content += "<tr>";
          row.append("<th>" + r + "</th>"); //row heading

          for (var c = smallestColumn; c != incrementColumn(largestColumn); c = incrementColumn(c)) {
            var td = $("<td></td>");
            td.html(getCellValue(c + r));
            td.addClass("type" + getCellType(c + r));
            row.append(td);
            // row.append("<td>"+getCellValue(c+r)+"</td>");
          }
          content.append(row);
          // content += "</tr>";
        }
        // content += "</table>";

        insertTextHighlights(meta.textHighlights, content[0]);
        // insertTextHighlights(that._id, content[0]);

        Session.set('content', content[0].outerHTML);
      });
    } else if (contentType === "application/msword") {
      Meteor.call("getOfficeContent", "word", doc._source.file, function (err, data) {
        var tempContent = $("<div />").html(data);
        insertTextHighlights(meta.textHighlights, tempContent[0]);
        Session.set("content", tempContent.html());
      });
    } else {
      var content = atob(doc._source.file);

      if (content.length < 1) return "";

      var lastQuery = Session.get("lastQuery");
      if (lastQuery !== undefined) {
        processQuery(lastQuery, function (term, isNegated, isPhrase) {
          if (isNegated) return;
          content = content.replace(new RegExp("(" + term + ")", "gi"), "<em>$1</em>");
        });
      }

      //Add the snippet highlight and text highlights if necessary
      //In order to be able to count the text chars only (without html tags)
      //we create a temporary element that we can walk over and find text nodes
      var tempContent = $("<div />").html(content);

      insertTextHighlights(meta.textHighlights, tempContent[0]);

      //PREVIEW SNIPPET
      var snippet = Session.get('detailDocumentPreviewSnippet');
      if (!lockPreviewSnippet && snippet && snippet.length > 0) {
        //for some reason, if the snippet is at the very end of the file content it 
        //has an additional line break at the end. Because of that, remove line ends
        //from the end of the snippet
        snippet = $("<span />").html(snippet).text();
        var endsWithBreak = snippet.indexOf(String.fromCharCode(0x0A), snippet.length - 1) !== -1;
        if (endsWithBreak) snippet = snippet.slice(0, snippet.length - 1);

        var startOffset = tempContent.text().indexOf(snippet);
        var endOffset = startOffset + snippet.length;
        if (startOffset >= 0 && endOffset >= 0) {
          //Create a fake highlight and add it to the text
          var fakeHighlight = [startOffset, endOffset, "transparent"];
          insertHighlightIntoDOM(tempContent[0], fakeHighlight, { cssClasses: "previewSnippet" });

          //Remember the current popup ID. For the timeouts, we check if the ID
          //changed - if so the popup was closed and/or reopened and we shouldn't
          //perform the snippet animations
          var currentID = popupID;

          //Fade in and out the preview snippet
          Meteor.setTimeout(function () {
            if (currentID === popupID) {
              $(".highlight.previewSnippet").first().scrollintoview({
                duration: "normal",
                complete: function () {
                  if (currentID === popupID) {
                    $(".highlight.previewSnippet").css("background-color", "rgba(255,0,0,1.0)");
                    $(".highlight.previewSnippet").css("color", "white");

                    Meteor.setTimeout(function () {
                      if (currentID === popupID) {
                        $(".highlight.previewSnippet").css("background-color", "transparent");
                        $(".highlight.previewSnippet").css("color", "");

                        //After the fade-out we lock the snippet so it will not be shown again
                        Meteor.setTimeout(function () {
                          if (currentID === popupID) {
                            lockPreviewSnippet = true;
                          }
                        }, 1000);
                      }
                    }, 2500);
                  }
                }
              });
            }
          }, 1000);
        }
      }

      content = tempContent.html();
      Session.set("content", encodeContent(content));
    }
  },

  comment: function () {
    var meta = DocumentMeta.findOne({ _id: this._id });
    if (meta) return meta.comment;
    return "";
  },

  isFavorited: function () {
    var meta = DocumentMeta.findOne({ _id: this._id });
    return (meta && meta.favorited);
  },

  deviceColorCSS: function () {
    var info = DeviceInfo.findOne({ _id: this.id });
    if (info === undefined || !info.colorDeg) return "";

    var color = window.degreesToColor(info.colorDeg);

    return 'color: rgb(' + color.r + ', ' + color.g + ', ' + color.b + ');';
  },

  document: function () {
    return Session.get("detailDocument") || undefined;
  },

  otherDevices: function () {
    return App.otherDevices;
  },


  //
  // "PUBLIC" API
  //

  /** Open method that opens this template in a fancybox with the given document
      and an optional snippetText that is highlighted after the load. This method
      is supposed to be called by other templates. **/
  open: function (doc, snippetText) {
    DocumentMeta._upsert(doc._id, { $set: { watched: true } });

    //Set the session variables that defines the popup content, then wait until
    //the next run loop until we actually show the popup. This prevents the popup
    //arriving in an unfinished state, which looks kinda ugly
    lockPreviewSnippet = false;
    Session.set("detailDocumentPreviewSnippet", snippetText);
    Session.set("detailDocument", doc);

    Meteor.setTimeout(function () {
      $.fancybox({
        href: "#documentDetails",
        autoSize: true,
        autoResize: true,
        beforeLoad: function () {
          lockPreviewSnippet = false;
          Session.set("detailDocumentPreviewSnippet", snippetText);
          Session.set("detailDocument", doc);
        },
        afterLoad: function () {
          //Dirty hack: 500ms delay so we are pretty sure that all DOM elements arrived
          Meteor.setTimeout(function () {
            attachEvents();
            $("#devicedropdown").chosen({
              width: "125px",
              disable_search_threshold: 100
            });
          }, 500);

          // $(".container").css({'height': '100%', 'overflow-y':'hidden'});
        },
        beforeClose: function () {
          //Increase popup ID on close, so we know the popup has changed
          popupID++;

          var doc = Session.get("detailDocument");
          if (doc !== undefined) {
            DocumentMeta._upsert(doc._id, { $set: { comment: $("#comment").val() } });
          }

          // $(".container").css({'height': '', 'overflow-y':'visible'});
        },
        afterClose: function () {
          lockPreviewSnippet = false;
          Session.set("detailDocumentPreviewSnippet", undefined);
          Session.set("detailDocument", undefined);

          var thisDevice = Session.get('thisDevice');
          Logs.insert({
            timestamp: Date.now(),
            route: Router.current().route.name,
            deviceID: thisDevice.id,
            actionType: "closeDocument",
            documentID: doc._id,
          });
        },
      });

      var thisDevice = Session.get('thisDevice');
      Logs.insert({
        timestamp: Date.now(),
        route: Router.current().route.name,
        deviceID: thisDevice.id,
        actionType: "openDocument",
        documentID: doc._id,
        selectedSnippet: $("<span />").html(snippetText).text()
      });
    }, 1);
  }
});


////////////////////
// ATTACH EVENTS //
///////////////////


var attachEvents = function () {

  var toggleFavorited = function () {
    var doc = Session.get("detailDocument");
    var meta = DocumentMeta.findOne({ _id: doc._id });
    var newValue;
    if (meta && meta.favorited) newValue = false;
    else newValue = true;

    DocumentMeta._upsert(doc._id, { $set: { favorited: newValue } });

    var thisDevice = Session.get('thisDevice');
    Logs.insert({
      timestamp: Date.now(),
      route: Router.current().route.name,
      deviceID: thisDevice.id,
      actionType: "toggledDocumentFavorite",
      actionSource: "documentDetails",
      documentID: doc._id,
      value: newValue,
    });
  };

  var addHighlightSelection;
  var prepareAddHighlight = function (e) {
    //See "prepareWorldView" for the reason why we need this
    addHighlightSelection = getContentSelection();
  };

  var addHighlight = function (e) {
    // var selection = getContentSelection();
    var selection = addHighlightSelection;
    var color = $(e.currentTarget).css("background-color");

    if (selection === undefined) return;

    var startOffset = selection[0];
    var endOffset = selection[1];

    //We do not want to allows overlapping highlights
    //Therefore, check every existing highlight if it intersects and modify it
    //to prevent overlap
    var doc = Session.get("detailDocument");
    var meta = DocumentMeta.findOne({ _id: doc._id });
    var updatedHighlights = [];
    if (meta && meta.textHighlights) {
      for (var i = 0; i < meta.textHighlights.length; i++) {
        var highlight = meta.textHighlights[i];
        var intersection = rangeIntersection(startOffset, endOffset, highlight[0], highlight[1]);

        //If the highlight is not intersected, keep it as it is
        if (intersection === undefined) {
          updatedHighlights.push(highlight);
          continue;
        }

        //If there is an intersection and both highlights have the same color
        //we merge them. To do that, we alter the new highlight (will be added later)
        //and remove the old highlight
        if (color === highlight[2]) {
          startOffset = Math.min(startOffset, highlight[0]);
          endOffset = Math.max(endOffset, highlight[1]);
          continue;
        }

        //If the entire highlight is intersected, it is removed (= not kept)
        if (intersection[0] === highlight[0] &&
          intersection[1] === highlight[1]) {
          continue;
        }

        //If the intersection is in the middle of the highlight, we need to split it
        if (intersection[0] > highlight[0] &&
          intersection[1] < highlight[1]) {
          var left = highlight.slice(0);
          var right = highlight.slice(0);
          left[1] = intersection[0];
          right[0] = intersection[1];
          updatedHighlights.push(left);
          updatedHighlights.push(right);

        }

        //If the start of the existing highlight is intersected, cut that part away
        if (intersection[0] === highlight[0] &&
          intersection[1] < highlight[1]) {
          highlight[0] = intersection[1];
          updatedHighlights.push(highlight);
        }

        //If the end of the existing highlight is intersected, cut that part away
        if (intersection[0] > highlight[0] &&
          intersection[1] === highlight[1]) {
          highlight[1] = intersection[0];
          updatedHighlights.push(highlight);
        }
      }
    }

    //Finally, add our selection as a new highlight, which now shouldn't interect
    //any other highlight. Then, write our new highlights in the DB
    updatedHighlights.push([startOffset, endOffset, color]);
    console.log(updatedHighlights);
    DocumentMeta._upsert(doc._id, { $set: { textHighlights: updatedHighlights } });

    var thisDevice = Session.get('thisDevice');
    Logs.insert({
      timestamp: Date.now(),
      route: Router.current().route.name,
      deviceID: thisDevice.id,
      actionType: "addedDocumentHighlight",
      actionSource: "detailDocument",
      documentID: doc._id,
      addedHighlight: [startOffset, endOffset, color],
      documentHighlights: updatedHighlights
    });
  };


  var deleteHighlights = function (e) {
    e.preventDefault();

    var count = countSelectedHighlights();

    if (count === 0) {
      var content = $("<span>You can remove text highlights by selecting them and tapping this button.</span>");
      showPopover(e.currentTarget, content, { autoHide: 3000, container: "body" });
    } else {
      var selection = getContentSelection();

      var highlightsString = (count === 1) ? 'highlight' : 'highlights';
      var content = $("<span>Do you want to remove <b>" + count + "</b> text " + highlightsString + "?<br/><br />");

      var yesButton = $("<button />");
      yesButton.html("<span class='glyphicon glyphicon-trash'></span> Yes, remove");
      yesButton.addClass("btn btn-danger noDeviceCustomization popupClickable");
      yesButton.css('margin-right', '25px');
      yesButton.on('click', function (e2) {
        deleteSelectedHighlights(selection);
        hidePopover(e.currentTarget);
      });

      var noButton = $("<button />");
      noButton.text("Cancel");
      noButton.addClass("btn btn-cancel noDeviceCustomization popupClickable");
      noButton.on('pointerup', function (e2) { //pointerup so text selection is kept
        e2.preventDefault();
        hidePopover(e.currentTarget);
      });

      content.append(yesButton);
      content.append(noButton);

      showPopover(e.currentTarget, content, { container: "body" });
    }
  };

  var saveComment = function () {
    var doc = Session.get("detailDocument");
    if (doc === undefined) return;

    var oldMeta = DocumentMeta.findOne({ _id: doc._id });

    var oldComment = oldMeta.comment;
    var newComment = $("#comment").val();

    if (oldComment !== newComment) {
      DocumentMeta._upsert(doc._id, { $set: { comment: newComment } });

      $("#savedText").css("opacity", 1.0);
      Meteor.setTimeout(function () {
        $("#savedText").css("opacity", 0);
      }, 1700);

      var thisDevice = Session.get('thisDevice');
      Logs.insert({
        timestamp: Date.now(),
        route: Router.current().route.name,
        deviceID: thisDevice.id,
        actionType: "changedDocumentComment",
        actionSource: "detailDocument",
        documentID: doc._id,
        comment: newComment
      });
    }
  };

  var timedSaveCommentTimer;
  var timedSaveComment = function () {
    Meteor.clearTimeout(timedSaveCommentTimer);
    timedSaveCommentTimer = Meteor.setTimeout(function () {
      saveComment();
    }, 2000);
  };

  var openShareView = function (e) {
    e.preventDefault();
    showSharePopup(e.currentTarget, "button");
  };

  var fixFixed = function () {
    //When the keyboard is shown or hidden, elements with position: fixed are
    //fucked up. This can sometimes be fixed by scrolling the body a little
    Meteor.setTimeout(function () {
      $("body").scrollTop($("body").scrollTop() + 1);
    }, 1);
  };

  var prevent = function (e) {
    e.preventDefault();
  };

  $("#detailDocumentStar").off("click");
  $("#detailDocumentStar").on("click", toggleFavorited);

  $(".highlightButton").off('pointerup');
  $(".highlightButton").on('pointerup', prepareAddHighlight);
  $(".highlightButton").off('click');
  $(".highlightButton").on('click', addHighlight);

  $("#deleteHighlightButton").off('pointerup');
  $("#deleteHighlightButton").on('pointerup', deleteHighlights);

  $("#comment").off('focus blur');
  $("#comment").on('focus blur', fixFixed);

  $("#comment").off("keyup");
  $("#comment").on("keyup", timedSaveComment);

  $("#shareButton").off('pointerup');
  $("#shareButton").on('pointerup', openShareView);
};

var showSharePopup = function (el, source) {
  var otherDevices = App.otherDevices;
  var text = App.detailDocument.currentlySelectedContent();

  var content;
  if (text !== undefined && text.length > 0) {
    content = $("<span>Send selected text to:</span>");
  } else {
    content = $("<span>Send document to:</span>");
  }
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

      var doc = Session.get("detailDocument");
      if (text !== undefined && text.length > 0) {
        //If a text selection exists, send it
        huddle.broadcast("addtextsnippet", { target: targetID, doc: doc._id, snippet: text });
        // pulseIndicator(e.currentTarget);
        // showSendConfirmation(e.currentTarget, "The selected text was sent to the device.");
        var thisDevice = Session.get('thisDevice');
        Logs.insert({
          timestamp: Date.now(),
          route: Router.current().route.name,
          deviceID: thisDevice.id,
          actionType: "shareSnippet",
          actionSource: "detailDocument",
          actionSubsource: source,
          targetDeviceID: targetID,
          documentID: doc._id,
          snippet: text,
        });
      } else {
        //If no selection was made but a document is open, send that
        if (doc !== undefined) {
          huddle.broadcast("showdocument", { target: targetID, documentID: doc._id });
          // pulseIndicator(e.currentTarget);
          // showSendConfirmation(e.currentTarget, "The document "+doc._id+" is displayed on the device.");
          var thisDevice = Session.get('thisDevice');
          Logs.insert({
            timestamp: Date.now(),
            route: Router.current().route.name,
            deviceID: thisDevice.id,
            actionType: "shareDocument",
            actionSource: "detailDocument",
            actionSubsource: source,
            targetDeviceID: targetID,
            documentID: doc._id
          });
        }
      }

      hidePopover(el);
    });
    content.append(link);
  }

  showPopover(el, content, { placement: "top", container: "body" });
};