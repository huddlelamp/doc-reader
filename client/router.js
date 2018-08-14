if (Meteor.isClient) {

  Router.configure({
    layoutTemplate: 'layout',
    loadingTemplate: 'loading'
  });

  Router.route('/', {
    template: 'searchIndex',
    name: 'searchIndex'
  });

  Router.route('/search/:_query?/:_page?', {
    template: 'searchIndex',
    waitOn: function () {
      return Meteor.subscribe('index-settings') && Meteor.subscribe('past-queries');
    },
    action: function () {
      if (this.ready()) {
        this.render();
      }
    }
  });

  Router.route('/snippets', {
    template: '/snippets'
  });

  Router.route('/task', {
    template: '/task'
  });
  Router.route('/admin/accounts', {
    template: 'accounts'
  });

  Router.route('/admin/index', {
    template: 'index'
  });

  // Router.route('/admin/settings', {
  //   template: 'settings'
  // });

  Router.route('*', {
    template: 'notFound'
  });
}