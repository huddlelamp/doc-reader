import { default as App } from '../app';

if (Meteor.isClient) {

  var SEARCH_RESULTS_PER_PAGE = 10;
  var SEARCH_FIELDS = ["file^10", "_name"];

  search = function(query, page, isGenuine) {
    if (query === undefined) return;
    if (page === undefined) page = 1;

    page = parseInt(page);

    Session.set('querySuggestions', []);

    var must = [];
    var must_not = [];

    //Create an elasticsearch-entry for each term in the query
    processQuery(query, function(term, isNegated, isPhrase) {
      var entry = {
        multi_match: {
          query: term,
          fields: SEARCH_FIELDS
        }
      };

      if (isPhrase) entry.multi_match.type = "phrase";

      if (isNegated)  must_not.push(entry);
      else            must.push(entry);
    });

    //elasticsearch can't handle empty must/must_not blocks
    var bool = {};
    if (must.length > 0) bool.must = must;
    if (must_not.length > 0) bool.must_not = must_not;

    // console.log(bool);

    var q = {
      fields: ["file", "name"],
      from: (page-1)*SEARCH_RESULTS_PER_PAGE,
      size: SEARCH_RESULTS_PER_PAGE,
      query: { bool: bool },
      highlight: {
        fields: {
          file: {},
          name: {}
        }
      }
    };
    // console.log(q);

    ElasticSearch.query(q, function(err, result) {
      if (err) {
        console.error(err);
      }
      else {
        var results = result.data;

        var observer = function(i) {
          return function(newDocument) {
            var results = Session.get('results');
            if (results === undefined) return;
            results.hits.hits[i].documentMeta = newDocument;
            Session.set('results', results);
          };
        };

        for (var i = 0; i < results.hits.hits.length ; i++) {
          var result = results.hits.hits[i];

          var cursor = DocumentMeta.find({_id: result._id});
          result.documentMeta = cursor.fetch()[0];

          cursor.observe({
            added   : observer(i),
            changed : observer(i),
            removed : observer(i),
          });
        }

        $('#search-query').val(query);

        Session.set("lastQuery", query);
        Session.set("lastQueryPage", page);
        Session.set("results", results);

        //If this is a genuine query (e.g. not one that, for example, originates by clicking a
        //pagination link) then we add it to the past queries
        if (isGenuine && results.hits.total > 0) {
          var pastQuery = PastQueries.findOne({ query: query.trim().toLowerCase() });
          if (pastQuery === undefined) {
            var newDoc = {
              query : query.trim().toLowerCase(),
              count : 1
            };
            PastQueries.insert(newDoc);
          } else {
            PastQueries.update({_id: pastQuery._id}, { $inc: {count: 1}});
          }
        }

        var thisDevice = Session.get('thisDevice');

        Logs.insert({
          timestamp       : Date.now(),
          route           : Router.current().route.name,
          deviceID        : thisDevice ? thisDevice.id : 'unknown',
          actionType      : "search",
          query           : query,
          page            : page,
          numberOfResults : results.hits.total
        });
      }
    });
  };

  Template.searchIndex.onRendered(function() {
    Template.searchIndex.reflectURL();

    $("body").on("mouseup", function(e) {
      Session.set('querySuggestions', []);
    });
  });

  Template.searchIndex.helpers({

    results: function() {
      var results = Session.get("results") || [];

      // console.log(results);

      return results;
    },

    querySuggestions: function() {
      return Session.get("querySuggestions") || [];
    },

    otherDevices: function() {
      return Session.get("otherDevices") || [];
    },

    isFavorited: function() {
      var meta = this.documentMeta;
      return (meta && meta.favorited);
    },

    hasComment: function() {
      var meta = this.documentMeta;
      return (meta && ((meta.comment && meta.comment.length > 0) || (meta.textHighlights && meta.textHighlights.length > 0)));
    },

    wasWatched: function() {
      var meta = this.documentMeta;
      return (meta && meta.watched);
    },

    querySuggestionShadowCSS: function() {
      var suggestions = Session.get("querySuggestions") || [];

      if (suggestions.length === 0) {
        return "none";
      } else {
        return "2px 2px 4px 0px rgba(0,0,0,0.75)";
      }
    },

    querySuggestionBorderCSS: function() {
      var suggestions = Session.get("querySuggestions") || [];

      if (suggestions.length === 0) {
        return "0px";
      } else {
        return "1px";
      }
    },

    querySuggestionPaddingCSS: function() {
      var suggestions = Session.get("querySuggestions") || [];

      if (suggestions.length === 0) {
        return "0px";
      } else {
        return "10px";
      }
    },

    querySuggestionHeightCSS: function() {
      var suggestions = Session.get("querySuggestions") || [];

      if (suggestions.length === 0) {
        return "0px";
      } else {
        return "500px";
      }
    }
  });

  Template.searchIndex.helpers({
    toSeconds: function(ms) {
      var time = new Date(ms);
      return time.getSeconds() + "." + time.getMilliseconds();
    },

    urlToDocument: function(id) {
      var s = Meteor.settings.public.elasticSearch;

      var url = s.protocol + "://" + s.host + ":" + s.port + "/" + IndexSettings.getActiveIndex() + "/" + s.attachmentsPath + "/" + id;
      return url;
    },

    /** Pluralizer. Returns singular if number is 1, otherwise plural **/
    pluralize: function(number, singular, plural) {
      if (number === undefined || number === null) number = 0;
      if (Array.isArray(number)) number = number.length;

      if (number === 1) return singular;
      return plural;
    },
  });

  Template.searchIndex.events({
    'click #search-btn': function(e, tmpl) {
      var query = tmpl.$('#search-query').val();
      search(query, 1, true);
    },

    'keyup #search-query': function(e, tmpl) {
      var query = tmpl.$('#search-query').val();
      if (query.trim().length === 0) {
        Session.set('querySuggestions', []);
        return;
      }

      //On enter, start the search
      if (e.keyCode == 13) {
        search(query, 1, true);
      //On escape, clear the query suggestions
      } else if (e.keyCode == 27) {
        Session.set('querySuggestions', []);
      //On every other key, try to fetch some query suggestions
      } else {
        // $("#search-tag-wrapper").empty();
        // tmpl.$('#search-query').val("");
        var unfinishedTerms = "";
        processQuery(query, function(term, isNegated, isPhrase, isFinished) {
          if (isFinished) {
            // $("#search-tag-wrapper").append("<span class='search-tag'>"+term+"</span>");
          } else {
            if (isPhrase) unfinishedTerms+= '"';
            unfinishedTerms += term+" ";
            // tmpl.$('#search-query').val(tmpl.$('#search-query').val()+" "+term);
          }
        });

        unfinishedTerms = unfinishedTerms.trim();
        // tmpl.$('#search-query').val(unfinishedTerms);

        var regexp = new RegExp('.*'+query+'.*', 'i');
        var suggestions = PastQueries.find(
          { query : { $regex: regexp } },
          { sort  : [["count", "desc"]], limit: 5 }
        );
        Session.set('querySuggestions', suggestions.fetch());
      }
    },

    'click .querySuggestion': function(e, tmpl) {
      tmpl.$('#search-query').val(this.query);
      search(this.query);
    },

    'click .paginationLink': function(e) {
      e.preventDefault();

      var query = $(e.currentTarget).attr("query");
      var page = $(e.currentTarget).attr("page");
      Router.go('searchIndex', {_query: query, _page: page});
      Template.searchIndex.reflectURL();
    },

    'click .toggleFavorited': function(e, tmpl) {
      var newValue;
      if (this.documentMeta && this.documentMeta.favorited) newValue = false;
      else newValue = true;

      DocumentMeta._upsert(this._id, {$set: {favorited: newValue}});

      var thisDevice = Session.get('thisDevice');
      Logs.insert({
        timestamp    : Date.now(),
        route        : Router.current().route.name,
        deviceID     : thisDevice.id,
        actionType   : "toggledDocumentFavorite",
        actionSource : "search",
        documentID   : this._id,
        value        : newValue,
      });
    },

    'click .hit': function(e, tmpl) {
      ElasticSearch.get(this._id, function(err, result) {
        if (err) {
          console.error(err);
        }
        else {
          App.detailDocument.open(result.data);
        }
      });
    },

    'click .document-highlight': function(e, tmpl) {
      var that = this;
      ElasticSearch.get($(e.currentTarget).attr("documentid"), function(err, result) {
        if (err) {
          console.error(err);
        }
        else {
          App.detailDocument.open(result.data, that.toString());
        }
      });
    },
  });
}

//
// "PUBLIC"
//

Template.searchIndex.reflectURL = function() {
  //If we have some parameters for search passed to us, do the appropiate search
  var query = Router._currentController.params._query ? decodeURIComponent(Router._currentController.params._query) : undefined;
  var page = Router._currentController.params._page ? decodeURIComponent(Router._currentController.params._page) : undefined;

  if (query !== undefined) {
    if (page === undefined) page = 1;

    $('#search-query').val(query);
    search(query, page);
  }
};


//
// PAGINATION
//

Template.pagination.helpers({

  currentQuery: function() {
    return Session.get('lastQuery') || undefined;
  },

  currentPage: function() {
    return Session.get("lastQueryPage") || 1;
  },

  pages: function() {
    var results = Session.get('results');
    if (results === undefined || !results.hits) return 0;

    var pages = Math.ceil(results.hits.total/SEARCH_RESULTS_PER_PAGE);

    var result = [];
    for (var i=1; i<=pages; i++) result.push(i);
    return result;
  },

  isEqual: function(v1, v2) {
    return v1 === v2;
  }
});
