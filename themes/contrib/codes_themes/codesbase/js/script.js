/**
 * Polyfill for jQuery 3.x support with Foundation 5.x
 */
(function ($) {
    $.fn.load = function(callback){ $(window).on("load", callback) };
})(jQuery);

(function($) {
  'use strict';

  // load foundation components
  $(function () {
    $(document).foundation();
  });

  Drupal.behaviors.codesbase = {
    attach: function (context, settings) {
      // TODO Move this into CSS
      // If we have partner android on page then hide
      if($('body').hasClass('platform-android')) {
        // hide the header and footer
        $('#meta-header-wrapper').hide();
        $('.region-header .menu').hide();
        $('footer').hide();
      }

      // see if there is no button on the page
      var $back_to_tld =  $('#back-to-tld');
      $back_to_tld.hide();

      // track for buttons passed in from requesting sites
      var dest_url = Drupal.behaviors.codesbase.getUrlParameter('dest_url');
      if(dest_url && dest_url.length) {
        var $back_to_tld_link = $('a', $back_to_tld);
        if(!$back_to_tld_link.length) {
          var link = '<div class="small-12 columns"><a class="button" href="' + dest_url + '">Back to ' + drupalSettings.codesBase.channel.name + '</a></div>';
          $back_to_tld.html(link);
        }

        $back_to_tld.show();
      }
    },

    /**
     * return params
    */
    getUrlParameter: function getUrlParameter(sParam) {
      var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

      for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
          return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
      }

      return null;
    }

  };

  // Drupal.behaviors.codesbase = {
  //   attach: function(context) {
  //     console.log("CODESbase loaded")
  //   }
  // };

})(jQuery);

