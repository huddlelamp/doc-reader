if (Meteor.isClient) {
  Template.navigation.helpers({
    // check if user is an admin
    isUser: function() {
      return Roles.userIsInRole(Meteor.user(), ['admin', 'user']);
    },

    // check if user is an admin
    isAdminUser: function() {
      return Roles.userIsInRole(Meteor.user(), ['admin']);
    },

    isRouteActive: function(options) {
      var opts = options.hash;

      if (typeof opts !== 'object')
        throw new Error("isRouteActive options must be key value pairs such as {{isRouteActive routeNames='[my.route.name]'}}. You passed: " + JSON.stringify(opts));

      opts = opts || {};
      var routeNames = opts.routeNames ? opts.routeNames.split(',') : [];

      var router = Router.current();
      if (router) {
        var route = router.route;
        var name = route.getName();

        for (var i = 0; i < routeNames.length; i++) {
          if (name === routeNames[i]) {
            return "active";
          }
        }
      }
      return "";
    }
  });
}
