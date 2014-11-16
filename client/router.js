if (Meteor.isClient) {

  Router.configure({
    layoutTemplate: 'layout',
    loadingTemplate: 'loading'
  });

  Router.route('/', {
    name: 'search.index',
    template: 'searchIndex'
  });

  Router.route('/search/:_query?/:_page?', {

    name: 'search.index.query',

    template: 'searchIndex',

    waitOn : function() {
      return Meteor.subscribe('index-settings') && Meteor.subscribe('past-queries');
    },

    data: function() {
      var query = this.params._query;
      var page = this.params._page;

      Session.set('lastQuery', query);
      Session.set('lastQueryPage', page);

      // return {
      //   query: query,
      //   page: page
      // }
    },

    action : function() {
      this.render();
    }
  });

  Router.route('/snippets', {
    name: 'snippets',
    template: 'snippets'
  });

  Router.route('/task', {
    name: 'task',
    template: 'task'
  });

  Router.route('/admin/accounts', {
    name: 'admin.accounts',
    template: 'accounts'
  });

  Router.route('/admin/index', {
    name: 'admin.index',
    template: 'index'
  });

  Router.route('*', {
    name: 'not.found',
    template: 'notFound'
  });
}
