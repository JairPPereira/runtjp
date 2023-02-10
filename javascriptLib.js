"use strict";

if(typeof jQuery == 'undefined'){
  var script = document.createElement('script');
  script.onload = function () {
    OTTeraJSLib(window, jQuery);
  };

  script.src = 'https://code.jquery.com/jquery-3.5.1.min.js';
  document.head.appendChild(script);
} else {
  jQuery(function() {
    OTTeraJSLib(window, jQuery);
  });
}

// load date-and-time if needed
if(typeof date == 'undefined'){
  var script = document.createElement('script');
  script.src = 'https://unpkg.com/date-and-time@0.14.2/date-and-time.min.js';
  script.onload = function () {
    var script2 = document.createElement('script');
    script2.src = 'https://unpkg.com/date-and-time@0.14.2/plugin/meridiem.js';
    document.head.appendChild(script2);
  };
  document.head.appendChild(script);
}

var OTTeraJSLib = function (w, $) {
  // Load date picker support if needed
  var datefield = document.createElement("input");
  datefield.setAttribute("type", "date");
  if (datefield.type !== "date") {
    var datePickerLink = document.createElement('link');
    datePickerLink.href = "https://unpkg.com/tiny-date-picker@3.2.8/tiny-date-picker.min.css";
    datePickerLink.rel = "stylesheet";
    datePickerLink.type = "text/css";
    document.head.appendChild(datePickerLink);

    var datePickerScript = document.createElement('script');
    datePickerScript.src = "https://unpkg.com/tiny-date-picker@3.2.8/dist/tiny-date-picker.js";
    document.head.appendChild(datePickerScript);

    // Add some CSS for the date picker
    $( "<style>.dp { background: black; color: #fff; } .dp::before { background: black } .dp-below {z-index: 10000;} .dp-below .dp-cal-header { display: block; background: black; } .dp-cal-footer { background: black; color: white; border-bottom-color: transparent; } .dp-cal-footer button { background: #444; color: white; } .dp-cal-month, .dp-cal-year, .dp-day, .dp-month, .dp-year { color: #fff; } </style>" ).appendTo( "head" );
  };

  w.OTTera = {
    jQueryVersion: null,

    options: {
      'api': 'https://api-ott.runtime.tv',
      'static_endpoint': 'https://js.static-ottera.com',
      'language': 'en',
      'available_languages': ['en'],
      'regcode': false,
      // dumpheaders option is enabled when param getheader is enabled on javascriptLib
      'dumpheaders' : 'false',
      headers: {}
    },

    configuration: null,

    user: null,

    dictionary: null,

    forms: null,

    products: null,

    optionsSet: false,

    optionsInterval: null,

    activeForm: null,

    browserCheck: {
      safari: false,
      ie: false,
      edge: false
    },

    // jquery refs and IDs
    refs: {
      datePicker: null,
      main: {
        root: 'ottera-js-root'
      },
      player: {
        id: 'ottera-player',
        ref: null
      },
      content: {
        id: 'ottera-content',
        ref: null
      },
      search: {
        id: 'ottera-search',
        ref: null,
        root: 'ottera-js-root--search'
      },
      browse: {
        id: 'ottera-browse',
        ref: null,
        root: 'ottera-js-root--browse'
      },
      linear: {
        id: 'ottera-linear-root',
        ref: null
      },
      // modal refs
      modals: {
        gdprFooter: null,
        form: null,
        externalLink: null,
      },
      // products ref
      products: null
    },

    // keys used for jquery.data
    dataKeys: {
      loadMore: 'ottera-load-more',
      rowStyle: 'ottera-row-style'
    },

    flickityOptions: {
      standard: {
        cellAlign: 'left',
        freeScroll: true,
        wrapAround: false,
        imagesLoaded: true,
        contain: true,
        pageDots: false
        // percentPosition: false,
        // prevNextButtons: false // will use on smaller screens
        // lazyLoad: true, // Maybe TODO
        // https://flickity.metafizzy.co/options.html#lazyload
      },
      slider: {
        cellAlign: 'center',
        freeScroll: false,
        wrapAround: true,
        imagesLoaded: true,
        contain: true,
        pageDots: false,
        autoPlay: 5000 // TODO when this comes in configuration, reset
      }
    },

    // flag that tracks whether fixing function has fired
    flickityFixed: false,

    // interval timers
    epgInterval: null,
    gdprFooterInterval: null,

    // are cookies blocked?
    cookiesBlocked: false,

    // @see buildContentObject()
    otteraGroups: {},

    forwardToAccount: false,

    /**
     * CRSF response to make additional form requests
     */
    formHandlerToken: null,

    configStorageKey: 'otteraConfig',
    configStorageRefreshKey: 'otteraConfigRefresh',

    params: {
      version: '',
      device_type: 'desktop', // TODO Use a browser detect library
      platform: 'web',
      partner: 'internal',
      language: 'en',
      connection: 'wifi' // TODO How do we tell?
    },

    cmsSettings: {
      options: null,
      partner: null
    },

    initialize: function() {
      // set the version to check so we can add proper responses
      w.OTTera.jQueryVersion = parseFloat($.fn.jquery);

      // initialize browser check constants
      w.OTTera.browserCheck.safari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));
      w.OTTera.browserCheck.ie = /*@cc_on!@*/false || !!document.documentMode;
      w.OTTera.browserCheck.edge = !w.OTTera.browserCheck.ie && !!window.StyleMedia;

      // check for existing auth_token
      var authToken = w.OTTera.getCookie('ottAuthToken');
      if(authToken && authToken.length) {
        w.OTTera.params.auth_token = authToken;
      }

      //Get dumpheaders output when dumpheaders option is enabled.
      if(w.OTTera.options.dumpheaders){
        let retval = this.makeRequest('dumpheaders', w.OTTera.params);
        retval.done(function(response) {
          let dumpHeaderOutput = {};
          dumpHeaderOutput["viewer-country"] = response.headers["cloudfront-viewer-country"];
          dumpHeaderOutput["viewer-country-region"] = response.headers["cloudfront-viewer-country-region"];
          dumpHeaderOutput["viewer-country-region-name"] = response.headers["cloudfront-viewer-country-region-name"];
  
          dumpHeaderOutput["viewer-city"] = response.headers["cloudfront-viewer-city"];
  
          dumpHeaderOutput["viewer-postal-code"] = response.headers["cloudfront-viewer-postal-code"]; 
  
          dumpHeaderOutput["viewer-time-zone"] =  response.headers["cloudfront-viewer-time-zone"];

          dumpHeaderOutput["viewer-latitude"] = response.headers["cloudfront-viewer-latitude"];
  
          dumpHeaderOutput["viewer-longitude"] = response.headers["cloudfront-viewer-longitude"];
          //add reformatted dumpheaders output to w.OTTera
          w.OTTera.dumpheaders = dumpHeaderOutput;
        });
      }

      // load the translations, then load configuration after success
      w.OTTera.getLanguage();
    },

    messageWindow: function(eventName, payload) {
      payload.name = eventName;
      w.postMessage(payload, window.location.origin);
    },

    makeRequest: function(action, params) {
      // merge params
      var params = $.extend({}, w.OTTera.params, params);

      // make sure there's always an auth_token in the params if available
      if (!params.auth_token) {
        var auth_token = w.OTTera.getAuthToken();
        if (auth_token) params.auth_token = auth_token;
      }

      // Add a timestamp, in seconds instead of ms
      if (!params.timestamp) {
        params.timestamp = Math.floor(Date.now() / 1000);
      }
      // Add timezone
      if (!params.timezone) {
        params.timezone = w.OTTera.getTimezone();
      }

      var headers = w.OTTera.getRequestHeaders();

      var permissionsActions = ['getmediaunlock', 'embeddedVideoPlayer'];
      if (permissionsActions.indexOf(action) !== -1) {
        if (!params.permissions && w.OTTera.getUserPermissions().length) {
          params.permissions = w.OTTera.getUserPermissions().join(',');
        }
      }

      var apiHost = w.OTTera.options.api;
      var apiHostProd = w.OTTera.options.api_prod ? w.OTTera.options.api_prod : w.OTTera.options.api;

      switch (action) {
        // check for checkout action to build redirect
        case 'checkout':
        case 'redirect':
          var queryParams = [];
          for(var x in params) {
            queryParams.push(x + '=' + params[x]);
          }
          return w.location = apiHost + '/' + action + '?' + queryParams.join('&');
          break;
        case 'formhandler':
          if (undefined === params.token) {
            return $.get({
              url: apiHost + '/' + action,
              data: params,
              headers: headers
            });
          } else {
            return $.post({
              url: apiHost + '/' + action,
              data: params,
              headers: headers
            });
          }
          break;
        case 'getconfiguration':
        case 'getreferencedobjects':
        case 'getobjects':
          return $.get({
            url: apiHost + '/' + action,
            data: params,
            headers: headers
          });
          break;
        case 'getvideosegments':
          return $.get({
            url: apiHostProd + '/' + action,
            data: params,
            headers: headers
          });
          break;
        //Call action dumpheaders API on host
        case 'dumpheaders':
          return $.get({
            url: apiHost + '/' + action,
            data: params,
            headers: headers
          });
          break;
        default:
          return $.post({
            url: apiHost + '/' + action,
            data: params,
            headers: headers
          });
      }
    },

    /**
     * Builds an API URL to be saved and called later
     * @param action
     * @param params
     * @returns {string}
     */
    makeRequestUrl: function (action, params) {
      params = $.extend({}, w.OTTera.params, params);

      // make sure there's always an auth_token in the params if available
      if (!params.auth_token && w.OTTera.otteraIsLoggedInJS()) {
        params.auth_token = w.OTTera.getCookie('ottAuthToken');
      }

      // add permissions params to requests that need them
      var permissionsActions = ['getmediaunlock', 'embeddedVideoPlayer'];
      if (permissionsActions.indexOf(action) !== -1) {
        if (!params.permissions && w.OTTera.getUserPermissions().length) {
          params.permissions = w.OTTera.getUserPermissions().join(',');
        }
      }

      // Add a timestamp, in seconds instead of ms
      if (!params.timestamp) {
        params.timestamp = Math.floor(Date.now() / 1000);
      }

      return w.OTTera.options.api + '/' + action + '?' + $.param(params);
    },

    getLanguage: function() {
      // get the language, configuration, dictionaries, and go

      // If there's an HTML5 path set, we should have a site-specific dictionary to load
      if (w.OTTera.options.static_endpoint && w.OTTera.options.html5_path) {
        var staticUrl = w.OTTera.options.static_endpoint + '/resources/' + w.OTTera.options.html5_path;

        $.get(staticUrl + '/js/check.js').then(function(data) {
          // var checkFn = window.Function(data);
          // checkFn(); // gets CONSTANT_ENABLED_LOCALES

          // Have to use eval here, because check.js uses var,
          // which keeps CONSTANT_ENABLED_LOCALES
          // out of global scope when executed in Function().
          window.eval(data);

          var enabledLocales = CONSTANT_ENABLED_LOCALES().split(',');

          // cache the available languages for later use
          w.OTTera.options.available_languages = enabledLocales;

          var language = (w.OTTera.params && w.OTTera.params.language) ? w.OTTera.params.language : 'en';

          // if a simple language code match fails…
          if (enabledLocales.indexOf(language) === -1) {
            // check more permissively (e.g. pt-br should match pt-rBR)
            language = w.OTTera.fuzzyMatchLanguages(language, enabledLocales);
          }

          return $.get(staticUrl + '/strings/' + language + '.json');
        }).then(function(response) {
          w.OTTera.dictionary = response;
          // call get configuration on success
          w.OTTera.getConfiguration();
        }).fail(function(error) {
          console.error('Dictionary retrieval failed. Loading fallback', error);

          loadFallbackDict();
        });
      } else {
        loadFallbackDict();
      }

      // helper that loads the fallback dictionary
      function loadFallbackDict() {
        $.get(w.OTTera.options.api + '/dictionaries/en.json').then(function(response) {
          w.OTTera.dictionary = response;
          // call get configuration on success
          w.OTTera.getConfiguration();
        }).fail(function(error) {
          console.error('Dictionary fallback failed. Force loading config', error);
          // Call getConfiguration despite failures
          w.OTTera.getConfiguration();
        });
      }
    },

    /**
     * Sometimes two-part language codes don't match between CMS, API, etc,
     * so try matching their chunks
     * e.g. pt-br should match pt_rBR and other variations
     *
     * @param language
     * @param enabledLocales
     * @returns string
     */
    fuzzyMatchLanguages: function(language, enabledLocales) {
      var langSplit = language.split('-');
      if (langSplit.length > 1) {
        var foundLangMatch = false;

        for (var l = 0; l < enabledLocales.length; l++) {
          var langCheck = enabledLocales[l];
          var langCheckSplit = langCheck.split('-');
          if (langCheckSplit.length > 1) {
            if (langCheckSplit[0].match(new RegExp(langSplit[0], 'i')) &&
                langCheckSplit[1].match(new RegExp(langSplit[1], 'i'))) {
              language = enabledLocales[l];
              foundLangMatch = true;
              break;
            }
          }
        }

        if (!foundLangMatch) {
          // default to en when extra language search doesn't work
          language = 'en';
        }
      } else {
        // chosen language is not actually enabled, default to english
        language = 'en';
      }

      return language;
    },

    

    /**
     * Get configuration from cache (localStorage) or the API as required
     */
    getConfiguration: function() {
      var storageKey = w.OTTera.configStorageKey;
      var storageRefreshKey = w.OTTera.configStorageRefreshKey;
      var nowTimestamp = Math.floor(Date.now() / 1000);

      // check if config should be refreshed
      var nextRefreshTimestamp = window.localStorage.getItem(storageRefreshKey);
      if (nextRefreshTimestamp && nowTimestamp < nextRefreshTimestamp) {
        if (window.localStorage.getItem(storageKey)) {
          console.log('Pulling config from cache');
          w.OTTera.configuration = JSON.parse(window.localStorage.getItem(storageKey));
          w.OTTera.useConfiguration();
          return;
        }
      } else {
        console.log("Config refresh interval has passed or not set - refreshing config");
      }

      var jqxhr = w.OTTera.makeRequest('getconfiguration', w.OTTera.params);
      jqxhr.done(function(response) {
        w.OTTera.configuration = response;
        window.localStorage.setItem(storageKey, JSON.stringify(response));
        window.localStorage.setItem(storageRefreshKey, nowTimestamp + parseInt(response.refresh_interval, 10));

        w.OTTera.useConfiguration();
      })
        .fail(function(response) {
          if (response.responseJSON.code) {
            w.OTTera.error("Error: " + response.responseJSON.code + ", " + response.responseJSON.message);
          } else if (response.responseJSON.error && response.responseJSON.error.message) {
            w.OTTera.error(response.responseJSON.error.message);
          }

          console.log('GetConfiguation Error', response);
        });
      // .always(function(response) {});
    },

    /**
     * When configuration has been retrieved from cache or remotely, act upon it
     */
    useConfiguration: function() {
      // loop the objects and grab the user
      if(undefined !== w.OTTera.configuration.objects) {
        for(var x in w.OTTera.configuration.objects) {
          var o = w.OTTera.configuration.objects[x];
          if(o.type === 'user') {
            w.OTTera.user = o;
          }
        }
      }

      w.OTTera.buildProducts();
      w.OTTera.buildForms();
      w.OTTera.messageWindow('ottera_initialized', {});
    },

    /**
     * Clear configuration cache
     */
    clearConfiguration: function() {
      window.localStorage.removeItem(w.OTTera.configStorageKey);
      window.localStorage.removeItem(w.OTTera.configStorageRefreshKey);
    },

    isAuthenticated: function() {
      if(w.OTTera.user) {
        return true;
      }

      if(undefined !== w.OTTera.params.auth_token) {
        return true;
      }

      var auth_token = w.OTTera.getCookie('ottAuthToken');
      if(auth_token && auth_token.length && auth_token !== 'null') {
        return true;
      }

      return false;
    },

    getAuthToken: function() {
      var auth_token = w.OTTera.getCookie('ottAuthToken');
      if(auth_token && auth_token.length && auth_token !== 'null') {
        return auth_token;
      }

      return null;
    },

    /**
     * Return all required rows from a form definition
     */
    getRequiredRows: function(rows) {
      return rows.filter(function(row) {
        return row.optional === false;
      });
    },

    /**
     * Returns an array of the pieces of interest in form rows
     * (e.g. an array of all the parameter names if pieces == 'parameter')
     */
    getRowPieces: function(rows, pieces) {
      return rows.map(function(row) {
        var newRow = {};

        if (typeof pieces === 'string') {
          newRow[pieces] = row[pieces];
        } else {
          for (var i = 0; i < pieces.length; i++) {
            newRow[pieces[i]] = row[pieces[i]];
          }
        }

        return newRow;
      });
    },

    /**
     * Transform date values returned by date fields into API-compatible values
     */
    transformDateValue: function(date) {
      return date.replace(/(\d+)-(\d+)-(\d+)/, function(whole, year, month, day) {
        return month + '/' + day + '/' + year;
      });
    },

    register: function(params) {
      // merge params
      var mergedParams = $.extend({}, params, w.OTTera.params);

      // check if we have a regcode in options
      // we do this here as we only want regcode sent on register
      var options = w.OTTera.getOptions();
      if(options.regcode && options.regcode.length) {
        mergedParams.regcode = options.regcode;
      }

      var form = w.OTTera.configuration.forms.register;
      var formIsPopulated = w.OTTera.validateFormRequiredFields(form, mergedParams);
      if (!formIsPopulated) {
        // actual error firing is handled by helper function
        return;
      }

      var dateRows = form.rows.filter(function(row) {
        return row.date === true;
      });
      var dateParams = w.OTTera.getRowPieces(dateRows, 'parameter');
      for (var d = 0; d < dateParams.length; d++) {
        mergedParams[dateParams[d].parameter] = w.OTTera.transformDateValue(mergedParams[dateParams[d].parameter]);
      }

      // block the form submit
      w.OTTera.blockFormSubmit('login');

      var jqxhr = w.OTTera.makeRequest('register', mergedParams);
      jqxhr.done(function(response) {
        w.OTTera.params.auth_token = response.auth_token;
        w.OTTera.user = response;
        w.OTTera.messageWindow('ottera_registered', {
          auth_token: response.auth_token ? response.auth_token : '',
          email: response.email ? response.email : '',
          uid: response.uid ? response.uid : '',
        });
      })
      .fail(function(response) {
        w.OTTera.messageWindow('ottera_register_failed', {name: 'ottera_register_failed'});
        w.OTTera.error(response.responseJSON.error.message);
      })
      .always(function(response) {
        // block the form submit
        if(w.OTTera.activeForm) {
          w.OTTera.unblockFormSubmit(w.OTTera.activeForm);
        }
      });
    },

    /**
     * Returns true if the form's required fields are populated,
     * otherwise short circuits and returns false
     *
     * This includes checkboxes, which the browser doesn't cover
     */
    validateFormRequiredFields: function(form, params) {
      var requiredRows = w.OTTera.getRequiredRows(form.rows);

      // matching rows have their own validation
      requiredRows = requiredRows.filter(function(row) {
        return row.validation !== 'match';
      });

      if (requiredRows.length) {
        for (var i = 0; i < requiredRows.length; i++) {
          var requiredRow = requiredRows[i];

          if (!params[requiredRow.parameter]) {
            var msg = '';
            if (requiredRow.error) {
              msg = w.OTTera.translatePlaceholder(requiredRow.error);
            } else {
              msg = 'Field "' + requiredRow.parameter + '" is required';
            }

            w.OTTera.error(msg);
            return false;
          }
        }
      }

      return true;
    },

    /**
     * Fire authentication endpoint with form params
     */
    authenticate: function(params) {
      // merge params
      var mergedParams = $.extend({}, params, w.OTTera.params);

      // block the form submit
      w.OTTera.blockFormSubmit('login');

      var jqxhr = w.OTTera.makeRequest('authenticate', mergedParams);
      jqxhr.done(function(response) {
        w.OTTera.clearConfiguration();

        w.OTTera.params.auth_token = response.auth_token;
        w.OTTera.user = response;
        w.OTTera.messageWindow('ottera_authenticated', {
          auth_token: response.auth_token ? response.auth_token : '',
          email: response.email ? response.email : '',
          uid: response.uid ? response.uid : '',
        });
      })
      .fail(function(response) {
        w.OTTera.messageWindow('ottera_authenticate_failed', {name: 'ottera_authenticate_failed'});
        w.OTTera.error(response.responseJSON.error.message);
        console.log("Authentication error", response);
      })
      .always(function(response) {
        // block the form submit
        if(w.OTTera.activeForm) {
          w.OTTera.unblockFormSubmit(w.OTTera.activeForm);
        }
      });
    },

    submitRegcodeForm: function(params, div_id_login) {
      if(undefined === params.regcode || !params.regcode.length) {
        return w.OTTera.error('No code has been entered');
      }

      // force the upgrade
      w.OTTera.upgrade(params);
    },

    loadFeedbackForm: function() {
      var jqxhr = w.OTTera.makeRequest('formhandler', {version: w.OTTera.params.version, form: 'feedback'});
      jqxhr.done(function(response) {
        w.OTTera.formHandlerToken = response.form.token;
      })
      .fail(function(response){
        console.log('Get feedback form failed', response);
      });
    },

    submitFeedbackForm:function(params) {
      // add the form type
      params.form = 'feedback';
      // get the token
      if(!w.OTTera.formHandlerToken) {
        w.OTTera.messageWindow('ottera_feedback_failed', {name: 'ottera_feedback_failed'});
        return w.OTTera.error("There was an issue loading the security token for this form. Please reload the page and try again.");
      }

      params.token = w.OTTera.formHandlerToken;

      var mergedParams = $.extend({}, params, w.OTTera.params),
          jqxhr = w.OTTera.makeRequest('formhandler', mergedParams);

      // block the form submit
      w.OTTera.blockFormSubmit('feedback');

      jqxhr.done(function(response) {
        w.OTTera.messageWindow('ottera_feedback_received', {name: 'ottera_feedback_received'});
      })
      .fail(function(response) {
        w.OTTera.messageWindow('ottera_feedback_failed', {name: 'ottera_feedback_failed'});
        console.log(response.responseJSON.error.message);
      })
      .always(function(response) {
        if(w.OTTera.activeForm) {
          w.OTTera.unblockFormSubmit(w.OTTera.activeForm);
        }
      });
    },

    logout: function() {
      delete(w.OTTera.params.auth_token);
      w.OTTera.user = null;
      w.OTTera.deleteCookie('ottAuthToken');
      w.OTTera.clearConfiguration();
      w.OTTera.messageWindow('ottera_logout', {});
    },

    redirect: function(params) {
      if(undefined === params.location) {
        params.location = 'account';
      }

      return w.OTTera.makeRequest('redirect', params);
    },

    /**
     * Attempts to upgrade the user
     *
     * Checks any active regcodes first, then login session will be checked in proceedToCheckout()
     *
     * @see proceedToCheckout
     * @param params
     */
    upgrade: function(params) {
      if(undefined === params.products) {
        params.products = 'video';
      }

      // merge params
      var mergedParams = $.extend({}, params, w.OTTera.params);

      // check the page for the regcode field and if a value exsits apply it
      var regcode = w.OTTera.getRegcode();
      if (regcode && regcode.length) {
        mergedParams.regcode = regcode;

        this.makeRequest('verifyregcode', {
          regcode: regcode
        }).then(function processRegcodeVerify(response) {
          if (response.data) {
            // regcode verification succeeded - go to checkout
            return w.OTTera.proceedToCheckout(mergedParams);
          } else {
            window.alert('Regcode is not valid. Please check it for typos and try again.');
            return false;
          }
        }, function processRegcodeFailure() {
          // if the endpoint fails for any reason, redirect to checkout
          return w.OTTera.proceedToCheckout(mergedParams);
        });
      } else {
        // No regcode, no need to call verify, just redirect to checkout
        return w.OTTera.proceedToCheckout(mergedParams);
      }
    },

    /**
     * Checks if there's an active user session, and redirects to checkout if so
     */
    proceedToCheckout: function(params) {
      if (this.isAuthenticated()) {
        params.auth_token = this.getAuthToken();
        return this.makeRequest('checkout', params);
      } else {
        this.loadLoginForm();
        window.alert("You must be logged in in order to check out.");
        return false;
      }
    },

    getUser: function() {
      return OTTera.user;
    },

    /**
     * Get the user's permissions
     */
    getUserPermissions: function() {
      var user = OTTera.user;

      if (user && user.permissions != null) {
        return user.permissions;
      } else {
        return [];
      }
    },

    getRegcode: function() {
      var $regcode = $('input[name="regcode"]', '#ottera-regcode-form');
      if($regcode.length && $regcode.val().length) {
        return $regcode.val();
      }

      // if nothing then return null
      return null;
    },

    /**
     * Returns the options array for
     * @return {{api: string}}
     */
    getOptions: function() {
      return w.OTTera.options;
    },

    setOptions: function(options) {
      $.extend(w.OTTera.options, options);
      w.OTTera.optionsSet = true;
    },

    /**
     * Set what we need from CMS
     */
    setCMSSettings: function(cmsSettings) {
      w.OTTera.cmsSettings.settings = cmsSettings.settings;
      w.OTTera.cmsSettings.partner = cmsSettings.partner ? cmsSettings.partner : null;
    },

    getProducts: function() {
      return w.OTTera.products;
    },

    buildProducts: function() {
      if(!w.OTTera.configuration || undefined === w.OTTera.configuration.services || undefined === w.OTTera.configuration.services.video || undefined === w.OTTera.configuration.services.video.products) {
        // log to console as some services will have no products
        return console.log('No products loaded in configuration');
      }

      // for now set the full product list and let each site display
      w.OTTera.products = w.OTTera.configuration.services.video.products;
    },

    buildForms: function() {
      if(!w.OTTera.configuration || undefined === w.OTTera.configuration.forms) {
        return w.OTTera.error('No forms loaded in configuration');
      }

      var rawForms = w.OTTera.configuration.forms,
          parsedForms = {};
      for(var id in rawForms) {
        var form = '<form id="ottera-' + id + '-form"> \n',
            behaviors = [{form_id: 'ottera-' + id + '-form'}];

        form += '<h3>' + w.OTTera.translatePlaceholder(rawForms[id].title) + '</h3> \n';
        for(var i in rawForms[id].rows) {
          var row = rawForms[id].rows[i];
          // start waterfall of if/else to look for what field type we should insert
          if(undefined !== row.submit) {
            form += '<div><a class="button" id="' + id + '-submit">' + w.OTTera.translatePlaceholder(row.text) + '</a></div> \n';
            behaviors.push({
              element_id: id + '-submit',
              on: 'click',
              callback: 'submitForm'
            });
          }
          else if (true === row.dropdown) {
            var label = w.OTTera.getFormRowText(row);

            var required = row.optional ? '' : 'required="required"';

            var options = '';
            for (var o = 0; o < row.options.length; o++) {
              options += '<option value="'+ row.options[o].value +'">'+ row.options[o].text +'</option>';
            }

            form += '<div><select name="'+ row.parameter +'" '+ required +'><option value="">'+ label +'</option>'+options+'</select></div> \n';
          }
          else if (true === row.checkbox) {
            var label = w.OTTera.getFormRowText(row);
            var checked = ' checked="checked"';
            var required = row.optional ? '' : ' required="required"';

            form += '<div><label><input name="'+ row.parameter +'" type="checkbox" value="'+ row.value +'"' + checked + required +'> ' + label + ' </label></div> \n';
          }
          else if(undefined !== row.parameter) {
            if(row.parameter !== 'message_body') {
              // form += '<label for="' + row.parameter + '">' + w.OTTera.translatePlaceholder(row.text) + '</label> \n';
              var type = 'text';
              var required = false;
              var readonly = false;
              var text= '';

              switch(row.parameter) {
                case 'password':
                  type = 'password';
                  required = true;
                  break;
                case 'email':
                  required = true;
                  type = 'email';
                  break;
                case 'username':
                  required = true;
                  break;
              }

              // other html5 form types
              var onfocus = '';
              if (true === row.date && 'field' === row.type) {
                type = 'text';
                onfocus = ' onfocus="(this.type=\'date\')"';
              }

              text = w.OTTera.getFormRowText(row);

              form += '<div><input type="' + type + '" name="' + row.parameter + '" id="field-' + row.parameter + '" placeholder="' + text + '"' + onfocus + (required ? ' required="required"' : '') + (readonly ? ' readonly="readonly"' : '') + ' autocapitalize="none" autocorrect="off" /></div> \n';
            }
            else {
              form += '<div><p><label for="' + row.parameter + '">' + w.OTTera.translatePlaceholder(row.placeholder) + '</label></p><textarea id="message_body" rows="5" cols="40"></textarea></div>';
            }
          }
          else if(undefined !== row.type) {
            if(row.type === 'button') {
              var klasses = ['button'];
              klasses.push(row.style);

              if(undefined !== row.link) {
                var link = w.OTTera.translateNavigation(row.link);
                if(link.indexOf('http') > -1) {
                  form += '<div><a href="' + link + '" class="' + klasses.join(' ') + '">' + w.OTTera.translatePlaceholder(row.text) + '</a></div> \n';
                }
                else {
                  var addedInline = false;

                  switch(link) {
                    case 'nav://profile':
                    case 'nav://register':
                      link = 'register';
                      behaviors.push({
                        element_id: 'button-' + link,
                        on: 'click',
                        callback: 'loadFormOnPage'
                      });
                      break;

                    case 'nav://forgotpassword':
                      link = '//' + w.location.host.replace(/^www|test|local/, 'account') + '/user/password';
                      form += '<div><a href="' + link + '" class="' + klasses.join(' ') + '">' + w.OTTera.translatePlaceholder(row.text) + '</a></div> \n';
                      addedInline = true;
                      break;

                    case 'nav://terms':
                      link = '//' + w.location.host.replace(/^www|test|local/, 'www') + '/terms';
                      form += '<div><a href="' + link + '" class="' + klasses.join(' ') + '" target="_blank">' + w.OTTera.translatePlaceholder(row.text) + '</a></div> \n';
                      addedInline = true;
                      break;

                    case 'local://returntologin':
                      link = 'login';
                      behaviors.push({
                        element_id: 'button-' + link,
                        on: 'click',
                        callback: 'loadFormOnPage'
                      });
                      break;
                  }

                  if (!addedInline) {
                    form += '<div><a class="' + klasses.join(' ') + '" id="button-' + link + '">' + w.OTTera.translatePlaceholder(row.text) + '</a></div> \n';
                  }
                }
              }
            }
            else if(row.type === 'text') {
              form += '<div><p>' + w.OTTera.translatePlaceholder(row.text) + '</p></div> \n';
            }
            else if(row.type === 'field') {
              // add verify password field
              if(row.placeholder === '::verify_placeholder::') {
                form += '<div><input type="password" id="verify-password" placeholder="' + w.OTTera.translatePlaceholder(row.placeholder) + '" required="required" name="password_verify" /></div> \n';
              }
            }
          }
          else {
            if(row.text === '::sign_agree::') {
              form += '<div><input type="checkbox" required="required" value="1"  name="agree_terms" /><label>' + w.OTTera.translatePlaceholder(row.text) + '</label></div> \n';
            }
          }
        }

        form += '</form>';

        // add the string to the parsedForms so it can be appended
        parsedForms[id] = {
          markup: form,
          behaviors: behaviors
        };
      }

      // add the regcode form
      var form = '<form id="ottera-regcode-form"> \n',
          behaviors = [{form_id: 'ottera-regcode-form'}];

      // Upgrade page strings, found either in dictionary or from Drupal settings
      var line1 = w.OTTera.translatePlaceholder("Or, if you have a registration code, please enter it here");
      var line2 = w.OTTera.translatePlaceholder("Enter code");
      var line3 = w.OTTera.translatePlaceholder("Apply Registration Code");
      // Pull translations from Drupal if available
      if (w.Drupal && w.Drupal.t) {
        line1 = w.Drupal.t('Or, if you have a registration code, please enter it here');
        line2 = w.Drupal.t('Enter code');
        line3 = w.Drupal.t('Apply Registration Code');
      }

      form += '<p>'+line1+'</p> \n';
      form += '<div><input type="text" name="regcode" id="field-regcode" placeholder="'+line2+'" autocapitalize="none" autocorrect="off" /></div> \n';
      form += '<div><a class="button" id="regcode-submit">'+line3+'</a></div> \n';
      form += '</form>';
      behaviors.push({
        element_id: 'regcode-submit',
        on: 'click',
        callback: 'submitForm'
      });

      parsedForms['regcode'] = {
        markup: form,
        behaviors: behaviors
      };

      w.OTTera.forms = parsedForms;
    },

    /**
     * Get the text for a form element (row) based on available options
     */
    getFormRowText: function(row) {
      var text = '';

      if(undefined !== row.text) {
        text = w.OTTera.translatePlaceholder(row.text);
      }
      else if(undefined !== row.placeholder) {
        text = w.OTTera.translatePlaceholder(row.placeholder);
      }

      if (!text) {
        text = row.text ? row.text : (row.placeholder ? row.placeholder : '');
      }

      return text;
    },

    /**
     * Requires form_id to load and div_id to append
     * @param object e
     *   {form_id: foo, div_id: base}
     */
    loadFormOnPage: function(e) {
      // check if this is loaded from an event
      if(undefined !== e.data) {
        e = e.data;
      }

      if(!w.OTTera.forms || undefined === w.OTTera.forms[e.id]) {
        w.OTTera.error("The requested form is not available to load");
      }

      //Remove existing forms
      for(var id in w.OTTera.forms) {
        // we want to leave the regcode form
        if(id === 'regcode') {
          continue;
        }

        var form = $('#ottera-' + id + '-form');
        if(form && form.length) {
          form.remove();
        }
      }

      // check for the form being actively loaded
      var activeLoad = (undefined !== e.action) ? e.action : e.id;

      // add the activeLoad markup to the page
      $('#'+e.div_id).append(w.OTTera.forms[activeLoad].markup);

      // behaviors
      var behaviors  = {
        id: activeLoad,
        div_id: e.div_id
      };

      if(activeLoad === 'regcode') {
        behaviors.div_id_login = e.div_id_login;
      }

      // add the click events
      w.OTTera.loadBehaviors(behaviors);

      // check for regcode in params and apply to form
      var queryParams = w.location.search.replace('?', '').split('&'),
          code = null;
      for(var x in queryParams) {
        var kv = queryParams[x].split('=');
        if(kv[0] === 'code' || kv[0] === 'regcode') {
          code = kv[1];
        }
      }

      if(e.id === 'feedback') {
        w.OTTera.loadFeedbackForm();
      }

      // message the window that we are ready
      w.OTTera.messageWindow('ottera_' + e.id + '_form_loaded', {name: 'ottera_' + e.id + '_form_loaded'});
    },

    /**
     * Called after markup is inserted onto the page
     * @param e
     */
    loadBehaviors: function(e) {
      var behaviors = w.OTTera.forms[e.id].behaviors,
          formId = null;

      behaviors.forEach(function(behavior, index) {
        var eventData = {};

        if(undefined !== behavior.form_id) {
          formId = behavior.form_id;
        }

        if(undefined !== behavior.on) {
          var callback = w.OTTera[behavior.callback];

          eventData.form_id = formId;
          eventData.element_id = behavior.element_id;
          eventData.id = e.id;

          if(undefined !== e.div_id_login) {
            eventData.div_id_login = e.div_id_login;
          }

          switch(behavior.element_id) {
            case 'button-login':
            case 'login-submit':
              eventData.action = 'login';
              break;
            case 'button-register':
            case 'register-submit':
              eventData.action = 'register';
              break;
            case 'feedback-submit':
              eventData.action = 'feedback';
              break;
            case 'regcode-submit':
              eventData.action = 'regcode';
              break;
          }

          switch(behavior.callback) {
            case 'loadFormOnPage':
              eventData.div_id = e.div_id;
              break;
          }

          $('#'+behavior.element_id, '#'+ e.div_id).on(behavior.on, eventData, callback);

        }
      });

      // load date picker if needed
      var dateField = w.document.querySelector('input[type=date]');
      if (w.TinyDatePicker && dateField) {
        // if the datepicker
        if (w.OTTera.refs.datePicker) {
          w.OTTera.refs.datePicker.destroy();
          w.OTTera.refs.datePicker = null;
        }

        w.OTTera.refs.datePicker = w.TinyDatePicker(dateField, {
          mode: 'dp-below',
          appendTo: w.document.querySelector('#ottera-modal')
        });
      }
    },

    translatePlaceholder: function(str) {
      var placeholder = str.replace(/::/g, '');
      var translated = null;
      if((placeholder in w.OTTera.dictionary) && w.OTTera.dictionary[placeholder].length) {
        translated = w.OTTera.dictionary[placeholder];
      }

      if (!translated) {
        translated = placeholder;
      }

      return translated;
    },

    /**
     * Look at placeholder syntax to redirect buttons; i.e. nav://profile -> register
     * @param str
     */
    translateNavigation: function(str) {
      var placeholder = str.replace(/::/g, ''),
      type = null;
      if(placeholder.indexOf('web://') > -1) {
        placeholder = placeholder.replace('web://', 'http://');
        // handle doubled-up protocol, if exists
        placeholder = placeholder.replace('http://http', 'http');
        type = decodeURIComponent(placeholder);
      }
      else if(placeholder.indexOf('webs://') > -1) {
        placeholder = placeholder.replace('webs://', 'https://');
        // handle doubled-up protocol, if exists
        placeholder = placeholder.replace('https://https', 'https');
        type = decodeURIComponent(placeholder);
      }
      else if(placeholder === 'local://contact') {
        type = 'https://www.google.com';
      }
      else if(placeholder === 'nav://forgotpassword') {
        type = w.location.protocol + "//" + w.OTTera.getAccountSite(w.location.host) + '/user/password';
      }
      else {
        type = placeholder;
      }
      return type;
    },

    /**
     * Takes a domain and returns the account site for it
     */
    getAccountSite: function(tld) {
      tld = tld || w.location.host;

      return tld.replace(/^(\w+\.)?(\w+.\w+)/, function(match, p1, p2) {
        return "account." + p2;
      });
    },

    submitForm: function(event) {
      var data = event.data;

      // load the formData
      var rawFormData = $('#'+data.form_id).serialize().split('&'),
          formData = {};
      for(var x in rawFormData) {
        var field = rawFormData[x].split('=');
        formData[field[0]] = field[1];
      }

      // work around for textarea is present
      if(undefined !== data.form_id && data.form_id === 'ottera-feedback-form') {
        formData.message_body = $('textarea#message_body', '#ottera-feedback-form').val();
      }

      // there isn't always a corresponding form for the incoming action (e.g. regcode)
      if (data.action && OTTera.configuration.forms && OTTera.configuration.forms[data.action]) {
        // validate passwords
        var form = OTTera.configuration.forms[data.action];
        var passwordVerifyRow = form.rows.filter(function(row) {
          return row.placeholder === "::verify_placeholder::" && row.secure === true;
        });
        if (passwordVerifyRow.length) {
          passwordVerifyRow = passwordVerifyRow[0];
        }

        if (passwordVerifyRow && formData.password_verify && formData.password && (formData.password_verify !== formData.password)) {
          event.preventDefault();

          var errorPlaceholder = passwordVerifyRow.error ? passwordVerifyRow.error : "Passwords do not match!";

          var msg = w.OTTera.translatePlaceholder(errorPlaceholder);
          w.OTTera.error(msg);
          return;
        } else {
          // password_verify field is just for verification
          if (formData.password_verify) {
            delete formData.password_verify;
          }
        }
      }

      switch(data.action) {
        case 'login':
          w.OTTera.authenticate(formData);
          break;
        case 'register':
          w.OTTera.register(formData);
          break;
        case 'regcode':
          w.OTTera.submitRegcodeForm(formData, data.div_id_login);
          break;
        case 'feedback':
          w.OTTera.submitFeedbackForm(formData);
          break;
      }
      return false;
    },

    blockFormSubmit: function(form_id) {
      w.OTTera.activeForm = form_id;
      var $submit = $('#'+form_id+'-submit');
      $submit.addClass('disabled');
      $submit.after('<div id="ottera-loader"></div>');
    },

    unblockFormSubmit: function() {
      var $submit = $('#'+w.OTTera.activeForm+'-submit');
      $submit.removeClass('disabled');
      $('#ottera-loader').remove();
      w.OTTera.activeForm = null;
    },

    error: function(message) {
      if(undefined === message) {
        message = 'There was an error';
      }

      alert(message);
    },

    setCookie: function(name, value, days, path, domain) {
      var expires = '',
          route = '/',
          domain = domain || '',
          samesite = 'SameSite=lax';

      if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
      }

      if (path) {
        route = path;
      }

      // set the route
      route = '; path=' + route;

      if (domain) {
        domain = '; domain=' + domain;
      }

      // set the SameSite attribute
      samesite = '; ' + samesite;

      w.document.cookie = name + '=' + (value || '')  + expires + route + domain + samesite;
    },

    getCookie: function(name) {
      var nameEQ = name + '=',
          ca = document.cookie.split(';');
      for(var i=0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
          c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) == 0) {
          return c.substring(nameEQ.length, c.length);
        }
      }

      return null;
    },

    deleteCookie: function(name) {
      w.OTTera.setCookie(name, null);
    },

    hasPermission: function(permission) {
      if(undefined == permission) {
        permission = 'PR';
      }

      if(!w.OTTera.isAuthenticated()) {
        return false;
      }

      if(!OTTera.user) {
        return false;
      }

      if(!OTTera.user.user_permission.length) {
        return false;
      }

      if(OTTera.user.user_permission.split(',').indexOf(permission) > -1) {
        return true;
      }

      return false;
    },

    detectDeviceType: function(userAgent) {
      userAgent = userAgent || navigator.userAgent;

      var deviceType = "desktop";
      if ( /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ) {
        deviceType = "handset";
	    } else if( /iPad/i.test(userAgent) ) {
        deviceType = "tablet";
	    }

      return deviceType;
    },

    /**
     * Platform will be "web" by default - for app redirects, we want iOS/Android if available
     */
    detectRedirectPlatform: function(userAgent) {
      userAgent = userAgent || navigator.userAgent;

      var appRedirectPlatform = w.OTTera.params.platform;
      if ( /Android/i.test(userAgent) ) {
          appRedirectPlatform = "android";
      } else if( /iPhone|iPad|iPod/i.test(userAgent) ) {
          appRedirectPlatform = "ios";
      }

      return appRedirectPlatform;
    },

    // set some default params for every OTTera request
    setDefaultParams: function (options) {
      w.OTTera.params.version = options.version;
      w.OTTera.params.platform = 'web';
      w.OTTera.params.language = w.OTTera.getCurrentLanguage();
    },

    /**
     * Get the preferred language from the browser
     * @see https://www.npmjs.com/package/navigator-languages
     *
     * @returns array
     */
    getNavigatorLanguages: function(){if('object'==typeof navigator){var c,a='anguage',b=navigator;return c=b['l'+a+'s'],c&&c.length?c:(a=b['l'+a]||b['browserL'+a]||b['userL'+a])?[a]:a}},

    /**
     * Get the current language to use for API calls,
     * first from the language cookie if available,
     * then the URL path if appropriate,
     * then from the browser
     *
     * This is different from getLanguage, which retrieves the dictionary to translate the UI
     *
     * @returns {string}
     */
    getCurrentLanguage: function() {
      // Use the language cookie if available
      if (w.OTTera.getCookie('ottera_lang')) {
        return w.OTTera.getCookie('ottera_lang').slice(0, 5);
      }

      var pathLangs = ['en', 'es', 'fr', 'cn', 'jp'];

      for(var i = 0; i < pathLangs.length; i++) {
        // if we're looking at a page like "/en/feature/movie-name", use that as the language
        if (window.location.pathname.search('/' + pathLangs[i]) === 0) {
          return pathLangs[i];
        }
      }

      // if there's nothing in the path, check what the user's browser says
      var userLangs = w.OTTera.getNavigatorLanguages();
      if (userLangs.length > 0) {
        var preferredLang = userLangs[0];

        // trim en-US or the like to just en
        return preferredLang.split('-')[0].toLowerCase();
      } else if (w.OTTera.cmsSettings && w.OTTera.cmsSettings.settings.options.language) {
        // otherwise return the default language from the channels settings
        return w.OTTera.cmsSettings.settings.options.language;
      } else {
        console.log('Returning default language');
        return pathLangs[0];
      }
    },

    /**
     * Helper function to retrieve a URL param by name
     *
     * @param name
     * @param url
     * @returns {string|null}
     */
    getUrlParameterByName: function (name, url) {
      if (!url) {
        url = window.location.href;
      }
      name = name.replace(/[\[\]]/g, '\\$&');
      var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
      if (!results) {
        return null;
      }
      if (!results[2]) {
        return '';
      }
      return decodeURIComponent(results[2].replace(/\+/g, ' '));
    },

    /**
     * Initialize public theme behaviors, mostly for webapp-enabled sites
     */
    initOtteraPublic: function() {
      // initialize date-and-time plugin(s) if available
      if (typeof w.date === 'object' || typeof w.date === 'function') {
        w.date.plugin('meridiem');
      }

      // setOptions and initialize the OTTera library
      var options = w.OTTera.cmsSettings.settings.options || w.OTTera.getOptions() || {};
      if (w.OTTera.cmsSettings.partner && w.OTTera.cmsSettings.partner.defaultRegcode) {
        if (w.OTTera.cmsSettings.partner.defaultRegcode.length) {
          options.regcode = w.OTTera.cmsSettings.partner.defaultRegcode;
        }
      }

      // set default params and options
      w.OTTera.setDefaultParams(options);
      w.OTTera.setOptions(options);

      // hide the upgrade link if cookie set
      var hideUpgrade = w.OTTera.getUrlParameterByName('hide_upgrade', window.location.href);
      if(w.OTTera.getCookie('ottHideUpgrade')) {
        // if we are on the home page and no param is set
        // then delete the cookie
        if(window.location.pathname === '/' && !hideUpgrade) {
          w.OTTera.setCookie('ottHideUpgrade', null);
        }
        else {
          w.OTTera.hideUpgradeLink();
        }
      }
      else {
        if(hideUpgrade && hideUpgrade == '1') {
          w.OTTera.hideUpgradeLink();
          w.OTTera.setCookie('ottHideUpgrade', '1', 365);
        }
      }

      // set up where ottera content will go (only on home page for now)
      // TODO this should probably be configurable
      var $main = $('#' + w.OTTera.refs.main.root);
      if ($main.length > 0) {
        $main.append('<div id="' + w.OTTera.refs.player.id + '"></div>')
          .append('<div id="' + w.OTTera.refs.content.id + '"></div>');
      }

      // set up where ottera search content will go
      // TODO this should probably be configurable
      var $searchMain = $('#' + w.OTTera.refs.search.root);
      if ($searchMain.length > 0) {
        $searchMain.append('<div id="' + w.OTTera.refs.search.id + '"></div>');
      }

      // set up where ottera browse content will go
      // TODO this should probably be configurable
      var $browseMain = $('#' + w.OTTera.refs.browse.root);
      if ($browseMain.length > 0) {
        $browseMain.append('<div id="' + w.OTTera.refs.browse.id + '"></div>');
      }

      // add the products
      w.OTTera.refs.products = $('#products').length ? $('#products') : null;

      // initialize modals
      w.OTTera.initModals();

      // hook clicks against the login event
      $('a[href="/#login"]').on('click', function (e) {
        e.preventDefault();

        if (!w.OTTera.isAuthenticated()) {
          w.OTTera.loadLoginForm();
        }
        else {
          w.OTTera.logout();
        }

        return false;
      });

      // hook click social links
      //TODO We can most likely separate this into a sub-module
      if ($('.social-links').length) {
        // add each specific click per service
        var facebook = $('.social-links .facebook-icon');
        if (facebook.length) {
          facebook.on('click', function () {
            FB.ui({
              method: 'share',
              href: window.location.href,
            }, function (res) {
              console.log('Facebook share responded', res);
            });
          });
        }
      }

      // open footer menu link in modal
      // $('footer ul.footer-menu a').on('click', function(e) {
      //   e.preventDefault();
      //
      //   Drupal.behaviors.codesbasePublic.openExternalLinkModal($(this));
      //
      //   return false;
      // });

      // add close if off-canvas is clicked
      var $leftOffCanvas = $('#left-off-canvas');
      $leftOffCanvas.on('click', function () {
        $(this).foundation('close');
      });

      // add vertical class to the left side/mobile nav block
      $leftOffCanvas.find('.block-mainnavigation').addClass('vertical');

      w.OTTera.showInstallAndroidApp();

      // add event listener for messages coming in
      window.addEventListener('message', function otteraMessageListener(event) {
        if (undefined != event.data.name) {

          // if forms loaded open modal
          if (event.data.name.indexOf('form_loaded') > 0) {
            // don't pop for regcode form since it is inline
            if (event.data.name !== 'ottera_regcode_form_loaded') {
              w.OTTera.openFormModal();
            }
          }

          switch (event.data.name) {
            case 'ottera_initialized':
              console.log("Event data ottera_initialized", event.data);
              // TODO check for upgrade path
              //  add regcode form
              if ($('#regcode-wrapper').length) {
                w.OTTera.loadFormOnPage({
                  id: 'regcode',
                  div_id: 'regcode-wrapper',
                  div_id_login: 'ottera-modal-inner'
                });
              }

              if (w.OTTera.refs.products) {
                // reset the html in case there is any garbage inside
                w.OTTera.refs.products.html('');

                if (w.OTTera.products.length) {
                  for (var x in w.OTTera.products) {
                    var product = w.OTTera.products[x];
                    var term = product.term.replace('per ', '');
                    var sku_a = product.sku.split('.');
                    var trial = false;
                    for (var y in sku_a) {
                      if (sku_a[y].indexOf('trial') > -1) {
                        trial = sku_a[y].replace('trial', '');
                      }
                    }

                    var price = product.price + " / " + term;
                    if (trial) {
                      price = trial + ' day free trial';
                    }

                    var productTemplate = "<div class='small-12 medium-6 columns align-center'>\n" +
                      "<div class='product'>\n" +
                      "<p><a class='button upgrade' data-product='" + product.sku + "' href='/upgrade'>" + price + "</a></p>\n";

                    if (undefined != product.note && product.note.length) {
                      productTemplate += "<p>" + product.note + "</p>\n";
                    }

                    productTemplate += "<p>cancel anytime</p>\n" +
                      "</div>\n" +
                      "</div>\n";

                    w.OTTera.refs.products.append(productTemplate);
                  }
                }

                $('a.upgrade').on('click', function clickUpgrade(e) {
                  e.preventDefault();

                  // if we aren't logged in we need to pop the form
                  if (!w.OTTera.isAuthenticated()) {
                    return w.OTTera.loadLoginForm();
                  }

                  var product = $(e.currentTarget).attr('data-product');
                  if (product.length) {
                    w.OTTera.upgrade({products: product});
                  }

                  return false;
                }.bind(this));
              }

              var regcode = w.OTTera.getActiveRegcode();

              if (w.OTTera.isPremiumUser()) {
                w.OTTera.hideUpgradeLink();
              }
              else if (w.OTTera.isAuthenticated()) {
                // put authenticated users straight through to checkout
                if (regcode && regcode.length) {
                  w.OTTera.upgrade({regcode: regcode});
                }
              }
              else {
                // not authenticated - just populate the field if it's there
                var $regcodeField = $('#field-regcode');
                if ($regcodeField.length) {
                  $regcodeField.val(regcode);
                }
              }

              // set up ottera refs and listeners
              var $contentRef = $('#' + w.OTTera.refs.content.id);
              w.OTTera.refs.content.ref = $contentRef.length ? $contentRef : null;

              var $playerRef = $('#' + w.OTTera.refs.player.id);
              w.OTTera.refs.player.ref = $playerRef.length ? $playerRef : null;

              // if there's a place to put OTTera content, initialize some more
              if (w.OTTera.refs.content.ref) {
                // w.OTTera.otteraContentRef.on('click', '.ottera-link-select',
                // w.OTTera.otteraSelectObject.bind(this));

                $('a[href="/"]').not('.toolbar-item').click(w.OTTera.showHomeJS.bind(this));

                w.OTTera.refs.content.ref.on('init-carousels', w.OTTera.initCarousels.bind(this));

                w.OTTera.showHomeJS();
              }

              var $searchRef = $('#' + w.OTTera.refs.search.id);
              w.OTTera.refs.search.ref = $searchRef.length ? $searchRef : null;
              if (w.OTTera.refs.search.ref) {
                w.OTTera.initSearch();
              }

              var $browseRef = $('#' + w.OTTera.refs.browse.id);
              w.OTTera.refs.browse.ref = $browseRef.length ? $browseRef : null;
              if (w.OTTera.refs.browse.ref) {
                w.OTTera.initBrowse();
              }

              var $linearRef = $('#' + w.OTTera.refs.linear.id);
              w.OTTera.refs.linear.ref = $linearRef.length ? $linearRef : null;
              if (w.OTTera.refs.linear.ref) {
                w.OTTera.initLinear();
              }

              w.OTTera.addLinks();

              // wire up the contact link that might have been added
              $('a[href="/#contact"]').on('click', function (e) {
                e.preventDefault();

                w.OTTera.loadFormOnPage({
                  id: 'feedback',
                  div_id: 'ottera-modal-inner'
                });

                return false;
              }.bind(this));

              // get the embedded players ready
              var playerTriggerClass = '.click-to-play',
                $playerTriggers = $(playerTriggerClass);
              if ($playerTriggers.length > 0) {
                w.OTTera.setupEmbeddedPlayers(playerTriggerClass);
              }

              // add behaviors for collections
              if ($('body').hasClass('node-type-collection')) {
                w.OTTera.setupCollection();
              }

              // add behaviors for shows
              if ($('body').hasClass('node-type-show')) {
                w.OTTera.setupShow();
              }

              // update any rendered links that need dynamic params
              w.OTTera.updateAPIParams();

              var resizeThrottle;
              $(window).resize(function (evt) {
                clearTimeout(resizeThrottle);
                resizeThrottle = setTimeout(w.OTTera.otteraResize, 250);
              }.bind(this));
              w.OTTera.otteraResize();

              break;

            case 'ottera_authenticated':
              // set the auth_token
              console.log("Event data ottera_authenticated", event.data);
              w.OTTera.setCookie('ottAuthToken', event.data.auth_token, 365);

              $('a[href="/#login"]').each(function () {
                $(this).html('Logout');
              });

              w.OTTera.closeFormModal();

              // check if we are flagged to redirect to account domain
              if(w.OTTera.forwardToAccount) {
                // set the flag back to false
                w.OTTera.forwardToAccount = false;
                return w.OTTera.makeRequest('redirect', {location: 'account', 'dest_url': window.location.href });
              }

              var regcode = w.OTTera.getActiveRegcode();

              // we should refresh on login unless we're on an upgrade page,
              // or otherwise have a regcode to test
              var shouldRefreshNow = window.location.pathname.search('/upgrade') !== -1 || !(regcode && regcode.length);
              if (shouldRefreshNow) {
                // reload the page
                window.location.reload();
                return;
              }

              if (!w.OTTera.isPremiumUser()) {
                // newly register user has no permission so forward to upgrade
                if (window.location.pathname.search('/upgrade') === -1) {
                  if (w.OTTera.doesPageExist('upgrade')) {
                    window.location = '/upgrade';
                  } else {
                     // if there is no upgrade path then forward to TLD
                    window.location = '/';
                  }
                }
                else {
                  if (regcode && regcode.length) {
                    w.OTTera.upgrade({regcode: regcode});
                  }
                }
              }
              else {
                w.OTTera.hideUpgradeLink();

                // hide overlays on videos for premium users
                var $videoNode = $('.node--video');
                if ($videoNode.length) {
                  $videoNode.find('.premium-message').fadeOut('fast');
                }
              }
              break;

            case 'ottera_registered':
              // set the auth_token
              console.log("Event data ottera_registered", event.data);
              w.OTTera.setCookie('ottAuthToken', event.data.auth_token, 365);

              $('a[href="/#login"]').each(function () {
                $(this).html('Logout');
              });

              w.OTTera.closeFormModal();

              // if a default regcode is available then put through checkout
              if (w.OTTera.cmsSettings.partner && w.OTTera.cmsSettings.partner.defaultRegcode) {
                if (w.OTTera.cmsSettings.partner.defaultRegcode.length) {
                  w.OTTera.upgrade({regcode: w.OTTera.cmsSettings.partner.defaultRegcode});
                }
              }
              // newly register user has no permission so forward to upgrade
              else if (window.location.pathname !== '/upgrade') {
                window.location = '/upgrade';
              }
              else {
                // if we are already on the upgrade path then check for regcode
                // and redirect to checkout if present
                var regcode = w.OTTera.getRegcode();
                if (regcode && regcode.length) {
                  w.OTTera.upgrade({regcode: regcode});
                }
              }
              break;

            case 'ottera_feedback_received':
              console.log("Event data ottera_feedback_received", event.data);
              w.OTTera.closeFormModal();
              alert('Feedback received');
              break;

            case 'ottera_logout':
              console.log("Event data ottera_logout", event.data);
              $('a[href="/#login"]').each(function () {
                $(this).html('Login/Register');
              });

              // delete the cookie
              w.OTTera.deleteCookie('ottAuthToken');

              // reload the page
              window.location.reload();
              break;
          }
        }
      }.bind(this), false);

      // check if already logged in
      var authToken = w.OTTera.getCookie('ottAuthToken');
      if (authToken && authToken.length) {
        $('a[href="/#login"]').each(function () {
          $(this).html('Logout');
        });
      }

      // set up JS for static show pages
      w.OTTera.initShowPage();

      w.OTTera.initialize();

      // finally pop the GDPR modal if needed
      w.OTTera.initGDPRFooter();
    },

    hideUpgradeLink: function () {
      $('ul.block-mainnavigation a[href="/upgrade"]').hide();
    },

    loadLoginForm: function () {
      w.OTTera.loadFormOnPage({
        id: 'login',
        div_id: 'ottera-modal-inner'
      });
    },

    loadContactForm: function () {
      w.OTTera.loadFormOnPage({
        id: 'feedback',
        div_id: 'ottera-modal-inner'
      });
    },

    loadRequestedModal: function() {
      // if we're trying to open a modal immediately, do it
      var openParam = w.OTTera.getUrlParameterByName('open');
      if (openParam) {
        switch (openParam) {
          case 'contact' :
            w.OTTera.loadContactForm();
            break;
        }
      }

      return true;
    },

    showInstallAndroidApp: function() {
      if (/Android/i.test(navigator.userAgent) && w.OTTera.cmsSettings.settings.devices.android && w.OTTera.cmsSettings.settings.devices.android.link) {
        // add cookie gate?
        // if (OTTera.getCookie('android-install'))

        var androidHtml = '<div class="install-android"><div class="install-android--icon"><a href="'+ w.OTTera.cmsSettings.settings.devices.android.link +'"></a></div><div class="install-android--copy"><h4 class="install-android--copy--header">Install the '+ w.OTTera.cmsSettings.settings.site_name +' app</h4><a class="install-android--button" href="'+ w.OTTera.cmsSettings.settings.devices.android.link +'"><img src="/themes/contrib/codes_themes/codesbase/images/devices/google-play.png" alt="Get the app on Google Play"></a></div><button class="install-android--close">˟</button></div>';

        $(document.body).append(androidHtml);
        androidHtml = null;

        var $install = $('.install-android');

        $install
          .on('click', '.install-android--close', function clickClose() {
            $install.removeClass('visible');
          });

        var androidTimeoutTimer = window.setTimeout(function startAndroidInstallPop() {
          $install.addClass('visible');
        }, 500);

        $(window).on('beforeunload', function clearAndroidTimer() {
          window.clearTimeout(androidTimeoutTimer);
        });
      }
    },

    initModals: function() {
      // add all modals
      w.OTTera.refs.modals.gdprFooter = $('#gdpr-footer').length ? $('#gdpr-footer') : null;
      w.OTTera.refs.modals.form = $('#ottera-modal').length ? $('#ottera-modal') : null;
      w.OTTera.refs.modals.externalLink = $('#external-modal').length ? $('#external-modal') : null;
    },

    openFormModal: function () {
      if (w.OTTera.refs.modals.form) {
        w.OTTera.refs.modals.form.foundation('open');
        // ensure to close the sidebar
        $('#left-off-canvas .close-button').trigger('click');
      }
      else {
        console.log('No form modal loaded');
      }
    },

    /**
     * Gets the active regcode in this order:
     *
     * 1.  From drupalSettings.codesPartner if available
     * 2.  From the URL query params
     * 3.  From the form on the page via OTTera.getRegcode
     */
    getActiveRegcode: function () {
      // default regcode comes from Drupal settings, and is preferred if
      // available
      if (w.OTTera.cmsSettings.partner && w.OTTera.cmsSettings.partner.defaultRegcode) {
        if (w.OTTera.cmsSettings.partner.defaultRegcode.length) {
          return w.OTTera.cmsSettings.partner.defaultRegcode;
        }
      }

      // fallback and use the regcode from the URL if it's not otherwise stored
      var urlRegcode = w.OTTera.getUrlParameterByName('regcode');
      if (urlRegcode) {
        return urlRegcode;
      }

      return w.OTTera.getRegcode();
    },

    isPremiumUser: function() {
      var permissions = OTTera.getUserPermissions();
      if(permissions.length) {
        for(var n in permissions) {
          if(permissions[n] === 'PR' || permissions[n].indexOf('SVOD') > -1) {
            return true;
          }
        }
      }
      //TODO this is the old way and can most likely be deprecated
      if(w.OTTera.hasPermission('PR')) {
        return true;
      }

      return false;
    },

    /**
     * Builds the homepage display
     * @param evt
     */
    showHomeJS: function (evt) {
      // if this isn't used as a click handler, ignore
      if (evt) {
        evt.preventDefault();
      }

      w.OTTera.refs.player.ref.html('');

      if (w.OTTera.configuration.sections !== null && w.OTTera.configuration.sections.length > 0 && w.OTTera.configuration.sections[0].items !== null) {
        w.OTTera.showContent(w.OTTera.configuration.sections[0].items);
      }
      else {
        w.OTTera.showContent(null);
      }
    },

    showContent: function (rows, ref) {
      ref = ref || w.OTTera.refs.content.ref;

      ref.html("");
      // $(otteraPlayerRef).html('');
      if (rows != null) {
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (row.endpoint === 'getvideosegments') continue;

          var parent_row_id = 'ottera--row--wrap--' + (row.parameters.parent_id ? row.parameters.parent_id : 'idx' + i);

          ref.append('<div class="ottera--row--wrap" id="' + parent_row_id + '"></div>');

          if (row["parameters"] != null && row["parameters"]["group_title"] != null) {
            row["title"] = row["parameters"]["group_title"];
          }

          w.OTTera.makeRequest(row.endpoint, row.parameters).then(function (row, parent_row_id, data) {
            // console.log('make request succeeded', data, row);

            var response = data;
            if (response != null) {
              if (response["objects"] != null && response["objects"].length > 0) {
                var content_row_id = parent_row_id.replace('--wrap', '--objects');
                var contentDiv = w.OTTera.buildContentDiv(content_row_id, response["objects"], row);

                var title = row["title"];

                var rowContent = '<h3 class="ottera--row--header">' + title + '</h3>';
                rowContent += contentDiv;
                ref.find('#' + parent_row_id).html(rowContent);

                var $contentRow = $('#' + content_row_id);

                $contentRow.data(w.OTTera.dataKeys.loadMore, {
                  endpoint: row.endpoint,
                  parameters: row.parameters,
                  start: parseInt(response.num_results, 10)
                }).data(w.OTTera.dataKeys.rowStyle, {
                  style: row.style ? row.style : 'table',
                  scale_factor: row.scale_factor ? row.scale_factor : 1
                });

                $contentRow.addClass('ottera-row-style--' + row.style);
                $contentRow.addClass('ottera-row-format--' + row.format);

                ref.trigger('init-carousels', [content_row_id]);
              }
            }
          }.bind(this, row, parent_row_id));
        }
      }
    },

    buildContentDiv: function (id, objects, rowContext) {
      var contentDiv = '<div class="ottera--row--objects" id="' + id + '">';
      for (var j = 0; j < objects.length; j++) {
        contentDiv += w.OTTera.buildContentObject(objects[j], 'string', rowContext);
      }
      contentDiv += '</div>';

      return contentDiv;
    },

    /**
     * Builds an object to go in a row for sliders, carousels, etc
     *
     * Type is always string for now, leaving the option for others
     *
     * @param object
     * @param returnType
     * @param rowContext
     * @returns {string}
     */
    buildContentObject: function (object, returnType, rowContext) {
      returnType = returnType || 'string';
      rowContext = rowContext || null;

      var isPremium = object['is_premium'] === 'true';

      var name = object["name"];
      var primaryID = object["primary_id"];
      var url = object["url"] ? object["url"] : '/node/' + primaryID;
      var type = object["type"];

      // if url starts with "default", get rid of it
      url = url.replace(/https?:\/\/default/, '');

      var thumbnailUrl = object["thumbnail_url"];
      if (rowContext !== null && rowContext.style === 'slider' && rowContext.parameters.image_format && rowContext.parameters.image_format === 'poster') {
        // if this is a slider, but it's been configured with posters, force widescreen
        // this will guard against widescreen premium thumbnails being overridden
        thumbnailUrl = object["widescreen_thumbnail_url"];
      } else if (isPremium && object["premium_thumbnail"]) {
        thumbnailUrl = object["premium_thumbnail"];
      }

      if (object["groups"] != null && object["groups"].length > 0) {
        w.OTTera.otteraGroups[primaryID] = object["groups"];
      }

      // other premium overrides
      var overlayMessage = '';
      if (isPremium && !w.OTTera.isPremiumUser()) {
        overlayMessage = w.OTTera.cmsSettings.settings.premium.message;
      }

      var overlay = '';
      if (overlayMessage) {
        overlay = '<div class="premium-overlay"><div class="premium-overlay--inner">' + overlayMessage + '</div></div>';
      }

      var objStr = '<a href="' + url + '" class="ottera--row--item ottera-link-select" data-ottera-id="' + primaryID + '" data-ottera-type="' + type + '" title="' + name + '" data-ottera-url="' + url + '"><img src="' + thumbnailUrl + '" alt="' + name + '" />' + overlay + '</a>';

      switch (returnType) {
        case 'string':
          return objStr;
        case 'jq':
          return $(objStr);
      }
    },

    /**
     * Initializes Flickity carousels/sliders
     *
     * @param evt
     * @param rowId
     */
    initCarousels: function (evt, rowId) {
      var $row = $('#' + rowId);

      // console.log('init carousels for row with data', rowId,
      // $row.data('ottera-load-more'));

      var styleOpts = $row.data(w.OTTera.dataKeys.rowStyle);

      var options = styleOpts.style === 'slider' ? w.OTTera.flickityOptions.slider : w.OTTera.flickityOptions.standard;

      $row.flickity(options);

      if (styleOpts.style === 'table') {
        $row.on('settle.flickity', function (evt, idx) {
          var flkty = $row.data('flickity');

          var visibleSlideCount = Math.ceil(flkty.size.outerWidth / flkty.selectedSlide.outerWidth);

          // we should load more if the selected slide is within the
          // visibleSlideCount of the last available cell (and we're not just
          // on the first slide)
          var shouldLoadMore = idx !== 0 && (flkty.selectedIndex + visibleSlideCount) > (flkty.cells.length - 1);

          // console.log('settle event fired in row', rowId, idx);
          if (shouldLoadMore) {
            var loadMore = $row.data(w.OTTera.dataKeys.loadMore);
            if (!loadMore) {
              return;
            }

            // console.log('last cell selected in row', rowId, idx);
            // console.log('will load more using ottera-load-more', loadMore);

            var params = $.extend({}, loadMore.parameters, {
              start: loadMore.start
            });

            w.OTTera.makeRequest(loadMore.endpoint, params).then(function (response) {
              if (!response || !response["objects"] || response["objects"].length === 0) {
                return;
              }

              // these come through as strings
              var start_index = parseInt(response.start_index, 10);
              var num_results = parseInt(response.num_results, 10);
              var total_results = parseInt(response.total_results, 10);

              var cells = '';
              for (var j = 0; j < response["objects"].length; j++) {
                cells += w.OTTera.buildContentObject(response["objects"][j]);
              }

              $row.flickity('append', $(cells));

              // reset the data for next time, or remove loadMore
              var newLoadMore;
              if (start_index < total_results) {
                newLoadMore = $.extend({}, loadMore, {
                  start: start_index + num_results
                });
              }
              else {
                newLoadMore = null;
              }

              // console.log('setting load more for next time', newLoadMore);
              $row.data(w.OTTera.dataKeys.loadMore, newLoadMore);
            }.bind(this));
          }
        }.bind(this));
      }

      $row.on('mouseenter mouseleave focus blur', '.ottera--row--item', w.OTTera.togglePremiumOverlay.bind(this, '.ottera--row--item'));

      w.OTTera.engageFlickityFix();
    },

    /**
     * Callback for items that display a premium overlay dynamically
     * @param itemClass
     * @param evt
     */
    togglePremiumOverlay: function (itemClass, evt) {
      var $link = $(evt.target).closest(itemClass);
      var $overlay = $link.find('.premium-overlay');

      if (!$overlay.length) {
        return;
      }

      // make sure premium users never see the overlay, and always have the
      // real URL
      if (w.OTTera.isPremiumUser()) {
        $link.attr('href', $link.data('ottera-url'));
        $overlay.hide();
        return;
      }

      // non-premium users get the upgrade URL, and see the overlay
      if (evt.type === 'mouseenter' || evt.type === 'focus') {
        $link.attr('href', w.OTTera.cmsSettings.settings.premium.link);
        $overlay.addClass('shown');
      }
      else {
        $overlay.removeClass('shown');
      }
    },

    /**
     * Adds a fix to help with slider/carousel performance
     * Gated to only be added once
     *
     * @see https://github.com/metafizzy/flickity/issues/959
     * @see https://gist.github.com/bakura10/b0647ef412eb7757fa6f0d2c74c1f145
     *
     */
    engageFlickityFix: function() {
      if (w.OTTera.flickityFixed) return;

      w.OTTera.flickityFixed = true;

      var touchingCarousel = false,
        touchStartCoords;

      document.body.addEventListener('touchstart', function(e) {
        if ($(e.target).closest('.flickity-slider')) {
          touchingCarousel = true;
        } else {
          touchingCarousel = false;
          return;
        }

        touchStartCoords = {
          x: e.touches[0].pageX,
          y: e.touches[0].pageY
        }
      });

      document.body.addEventListener('touchmove', function(e) {
        if (!(touchingCarousel && e.cancelable)) {
          return;
        }

        var moveVector = {
          x: e.touches[0].pageX - touchStartCoords.x,
          y: e.touches[0].pageY - touchStartCoords.y
        };

        if (Math.abs(moveVector.x) > 7)
          e.preventDefault()

      }, {passive: false});
    },

    /**
     * Behaviors for the /search endpoint
     */
    initSearch: function () {
      w.OTTera.refs.search.ref.html('<form class="ottera-js-search--form">\n' +
        '<div class="input-group">' +
        '    <input type="search" placeholder="Search…" class="ottera-js-search--field input-group-field">\n' +
        '    <button class="ottera-js-search--button input-group-button button">Go</button>\n' +
        '</div>\n' +
        '</form>\n' +
        '\n' +
        '<div id="ottera-js-search--results">' +
        '</div>');

        w.OTTera.refs.search.ref.on('init-carousels', w.OTTera.initCarousels.bind(this));

        var searchFormClass = '.ottera-js-search--form';

        w.OTTera.refs.search.ref.on('submit', searchFormClass, function submitOtteraSearch(evt) {
        evt.preventDefault();

        var $form = $(evt.target).closest(searchFormClass),
          searchKey = $form.find('input').val().trim(),
          $resultsArea = $('#ottera-js-search--results');

        if (!searchKey) {
          return false;
        }
        else {
          $resultsArea.html('');
        }

        /*
        Sample params:
       {"b_image_height":"360","banners":"1","connection":"wifi","device_height":"720","device_id":"web","device_manufacturer":"Mozilla","device_model":"Mozilla tv","device_type":"tv","device_width":"1280","image_width":"284","key":"drink","language":"en","object_type":"show","partner":"html5","platform":"html5","start":"0","timestamp":"1581366480","timezone":"-0700","version":"12.100"}
         */

        var showSearch = w.OTTera.configuration.requests.search_show,
          videoSearch = w.OTTera.configuration.requests.search_non_episode;

        var searchParams = {
          show: $.extend({}, w.OTTera.params, showSearch.parameters, {key: searchKey}),
          videos: $.extend({}, w.OTTera.params, videoSearch.parameters, {key: searchKey}),
        };

        $.when(
          w.OTTera.makeRequest(showSearch.endpoint, searchParams.show),
          w.OTTera.makeRequest(videoSearch.endpoint, searchParams.videos)
        ).done(function otteraSearchDone(showsData, videosData) {
          // console.log('shows', showsData);
          // console.log('videos', videosData);

          var haveResults = false;

          if (showsData[0] && parseInt(showsData[0].num_results, 10) > 0) {
            haveResults = true;

            var row_id = 'ottera--row--objects--shows';
            var contentDiv = w.OTTera.buildContentDiv('ottera--row--objects--shows', showsData[0].objects);

            $resultsArea.append('<h3 class="ottera--row--header">Shows</h3>');
            $resultsArea.append(contentDiv);

            $('#' + row_id).data(w.OTTera.dataKeys.loadMore, {
              endpoint: showSearch.endpoint,
              parameters: searchParams.show,
              start: parseInt(showsData[0].num_results, 10)
            }).data(w.OTTera.dataKeys.rowStyle, {
              style: 'table',
              scale_factor: 1
            });

            w.OTTera.refs.search.ref.trigger('init-carousels', [row_id]);
          }

          if (videosData[0] && parseInt(videosData[0].num_results, 10) > 0) {
            haveResults = true;

            var row_id = 'ottera--row--objects--videos';
            var contentDiv = w.OTTera.buildContentDiv(row_id, videosData[0].objects);

            $resultsArea.append('<h3 class="ottera--row--header">Videos</h3>');
            $resultsArea.append(contentDiv);

            $('#' + row_id).data(w.OTTera.dataKeys.loadMore, {
              endpoint: videoSearch.endpoint,
              parameters: searchParams.videos,
              start: parseInt(videosData[0].num_results, 10)
            }).data(w.OTTera.dataKeys.rowStyle, {
              style: 'table',
              scale_factor: 1
            });

            w.OTTera.refs.search.ref.trigger('init-carousels', [row_id]);
          }

          if (!haveResults) {
            $resultsArea.append('<p class="search--no-results">No results found</p>');
          }
        }.bind(this));
      }.bind(this));
    },

    /**
     * Behaviors for the /browse endpoint
     * @backfilled as initBrowse
     */
    initBrowse: function () {
      var browseSection = w.OTTera.configuration.sections.filter(function (s) {
        return s.section === 'browse';
      });
      browseSection = browseSection.length >= 1 ? browseSection[0] : NULL;
      if (!browseSection) {
        return;
      }

      w.OTTera.showContent(browseSection.items, w.OTTera.refs.browse.ref);

      w.OTTera.refs.browse.ref.on('init-carousels', w.OTTera.initCarousels.bind(this));
    },

    initLinear: function() {
      if (!w.OTTera.configuration.services.video.linear_player) return;

      w.OTTera.refs.linear.ref.html('<div id="ottera-linear-player">'+ w.OTTera.getPlayerEmbedHtml() +'</div><div id="ottera-linear-epg"></div>');

      var linearParams = $.extend({}, w.OTTera.configuration.services.video.linear_player.current_object, {
        auto_play: {
          desktop: true,
          mobile: true
        },
        mute: true
      });

      w.OTTera.loadEmbeddedPlayer(linearParams);

      w.OTTera.updateOtteraEPG('ottera-linear-epg', w.OTTera.configuration.services.video.linear_player.current_object.linear_channel_id);

      // refresh the EPG every 15 minutes
      w.OTTera.epgInterval = window.setInterval(w.OTTera.updateOtteraEPG.bind(this, 'ottera-linear-epg', w.OTTera.configuration.services.video.linear_player.current_object.linear_channel_id), (15 * 60 * 1000));

      $(window).on('beforeunload.epgtimer', function cleanUpEPGTimer() {
        window.clearInterval(w.OTTera.epgInterval);
      }.bind(this))
    },

    loadEmbeddedPlayer: function(extra_params) {
      extra_params = extra_params || {};

        var defaultParams = {
          "div_id": "video_player",
          "content_page_url": encodeURIComponent(window.location.href),
          "image_width": "1280",
          "mute": false
        };

        var params = $.extend({}, defaultParams, extra_params);

        var deviceType = "desktop";
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          deviceType = "handset";
          //TODO If we get tablet in her add another size alternative
          params.image_width = '768';
        }

        var url = w.OTTera.makeRequestUrl('embeddedVideoPlayer', params);

        var script = document.createElement('script');
        // Comment this out when you are done testing
      // script.onload = function () {
      //   console.log('Player script loaded');
      // };
        script.src = url;
        document.head.appendChild(script);
    },

    getPlayerEmbedHtml: function() {
      return '<style> \
                        .player-container { \
                        width: 100%; \
                        display: inline-block; \
                        position: relative; \
                      } \
                      \
                      /* If using the enable_floating, you must have a player-floating inner div */ \
                      .player-inner.floating { \
                        position: fixed; \
                        bottom: 20px; \
                        right: 20px; \
                        width: 250px; \
                        height: 140px; \
                        z-index: 2; \
                        transition: 0.3s; \
                      } \
                    </style> \
                    <div class="player-container"> \
                      <div class="player-inner"> \
                        <div id="dummy" style="margin-top: 56.25%;"></div> \
                        <div id="video_player" style="position:absolute; top:0; left:0; left:0; right:0; bottom:0;" itemprop="video" itemscope itemtype="http://schema.org/VideoObject"></div> \
                      </div> \
                    </div>';
    },

    otteraIsLoggedInJS: function () {
      var authToken = w.OTTera.getCookie('ottAuthToken');
      return authToken && authToken.length;
    },
    /**
     *
     * @param root_id
     * @param primary_id
     *
     * @backfilled
     */
    updateOtteraEPG: function(root_id, primary_id) {
      // console.log('updateOtteraEPG', w.OTTera.flickityOptions, root_id, primary_id);

      var $root = $('#' + root_id);

      // JS returns milliseconds, we want seconds
      var currentTimestamp = Math.floor(Date.now() / 1000);

      w.OTTera.makeRequest('getvideosegments', {
        parent_type: 'linear_channel',
        linear_channel_id: primary_id,
        max: 36
      }).then(function (data) {
        $root.html('');

        var objects = data.objects;
        var epgBlock = '';
        var epgContent = '';

        for (var i = 0; i < objects.length; i++) {
          var epg_obj = objects[i];

          var itemName;
          var itemTimeslot;
          if (epg_obj.inline_text) {
            itemName = this.convertStringPlaceholders(epg_obj.inline_text.details);
            itemTimeslot = this.convertStringPlaceholders(epg_obj.inline_text.heading);
          } else {
            var endSeconds = parseInt(epg_obj.segment_end_time, 10);

            // skip anything that's already passed
            if (currentTimestamp > endSeconds) {
              continue;
            }

            // convert times to ms for JS conversion
            var segStart = new Date(parseInt(epg_obj.segment_start_time, 10) * 1000);
            var segEnd = new Date(endSeconds * 1000);
            var timeFormat = 'h:mma';

            var timeOffset = 0; //segStart.getTimezoneOffset(); // minutes to be subtracted

            var start = w.date.format(w.date.addMinutes(segStart, 0 - timeOffset), timeFormat);
            var end = w.date.format(w.date.addMinutes(segEnd, 0 - timeOffset), timeFormat);

            itemName = epg_obj.name;
            itemTimeslot = start + ' – ' + end;
          }

          epgBlock = '<div class="ottera--epg">' +
            // '<a href="/node/' + epg_obj.video_id + '" title="Watch \'' + epg_obj.name + '\' now">' +
            '<div class="ottera--epg--thumbnail"><img src="' + epg_obj.thumbnail_url + '" alt="" loading="lazy"></div>' +
            '<div class="ottera--epg--text">' +
              '<div class="ottera--epg--time">' + itemTimeslot +'</div>' +
              '<h3 class="ottera--epg--title">' + itemName +'</h3>' +
            '</div>' +
            // '</a>' +
            '</div>';

          epgContent += epgBlock;
        }

        epgContent += '</div>';
        $root.html(epgContent);

        w.OTTera.messageWindow('ottera_epg_updated', {count: objects.length});
      }.bind(this));
    },

    doesPageExist: function(page) {
      if (w.OTTera.cmsSettings.settings && undefined !== w.OTTera.cmsSettings.settings.pages && undefined !== w.OTTera.cmsSettings.settings.pages[page]) {
        return true;
      }

      return false;
    },

    addLinks: function () {
      // add account link
      if (w.OTTera.doesPageExist('account')) {
        $('ul.block-mainnavigation').each(function() {
          $(this).append('<li role="menuitem"><a href="/#account">Account</a></li>');
        });

        // add click and hide
        var $accountLink = $('a[href="/#account"]', 'ul.block-mainnavigation');
        $accountLink.on('click', function(){
          if(!w.OTTera.isAuthenticated()) {
            w.OTTera.forwardToAccount = true;
            w.OTTera.loadLoginForm();
          }
          else {
            w.OTTera.makeRequest('redirect', {location: 'account', 'dest_url': window.location.href });
          }

          return false;
        });

      }

      // add search link
      if (w.OTTera.doesPageExist('search')) {
        $('.meta-header-inner').append('<a href="/search" class="header-search-icon"><i class="fas fa-search"></i></a>');
      }

      // add contact link, if needed
      if (w.OTTera.configuration.forms && typeof w.OTTera.configuration.forms.feedback === 'object') {
        var $footerMenu = $('.footer-menu');
        var $existingContact = $footerMenu.find('a[href="/#contact"]');

        if (!$existingContact.length) {
          $footerMenu.append('<li><a href="/#contact">Contact</a></li>');
        }
      }
    },

    /**
     * Sets up embedded video players
     * @param playerTriggerClass
     *
     * @backfilled
     */
    setupEmbeddedPlayers: function (playerTriggerClass) {
      var $playerArea = $(playerTriggerClass);

      // if this user is logged in already, remove the premium overlay
      if (w.OTTera.isPremiumUser()) {
        $playerArea.find('.premium-message').remove();
      }
      else {
        $playerArea.find('.premium-message').addClass('not-premium');
      }

      w.OTTera.loadEmbeddedPlayer({
        id: $playerArea.data('ottera-id')
      });
      $playerArea.find('.player-container').fadeIn('fast');
      $playerArea.find('.play-icon').hide();
    },

    /**
     * Add collection behaviors
     */
    setupCollection: function () {
      var linkClass = '.collection--item';
      $('.collection--items').on('mouseenter mouseleave focus blur', linkClass, w.OTTera.togglePremiumOverlay.bind(this, linkClass));
    },

    /**
     * Add show behaviors
     */
    setupShow: function () {
      var linkClass = '.episode--item';
      $('.show--season-episodes').on('mouseenter mouseleave focus blur', linkClass, w.OTTera.togglePremiumOverlay.bind(this, linkClass));
    },

    /**
     * Any static params in page links that need adjusted are adjusted
     *
     * @see w.OTTera.otteraResize for another param adjuster
     */
    updateAPIParams: function() {
      var $appLinks = $('.app-deep-link');
      if ($appLinks.length) {
        var link = $appLinks.attr('href');

        link = link.replace(/platform=\w+(&?)/, 'platform=' +  w.OTTera.detectRedirectPlatform() +'$1');
        link = link.replace(/device_type=\w+(&?)/, 'device_type=' +  w.OTTera.detectDeviceType() +'$1');

        $appLinks.attr('href', link);
      }
    },
    /**
     * Callback handling resize event
     *
     */
    otteraResize: function () {
      // decent guess, not guaranteed
      var hasTouch = 'ontouchstart' in window;
      var width = $(window).width();
      var device = 'desktop';

      if (width > 1024) {
        device = 'desktop';
        // device = !hasTouch ? 'desktop' : 'tablet';
      }
      else if (width >= 640) {
        device = 'tablet';
      }
      else {
        device = 'handset';
        // device = !hasTouch ? 'desktop' : 'handset';
      }

      w.OTTera.params.device_type = device;
      // console.log('OtteraResize', window.OTTera.params);
    },

    closeFormModal: function () {
      if (w.OTTera.refs.modals.form) {
        w.OTTera.refs.modals.form.foundation('close');
      }
      else {
        console.log('No form modal loaded');
      }
    },

    /**
     * Behaviors for show nodes
     */
    initShowPage: function () {
      var $showEpisodes = $('.node--show .show--season-episodes');

      if ($showEpisodes.length === 0) {
        return;
      }

      $showEpisodes.flickity(w.OTTera.flickityOptions.standard);
    },

    initGDPRFooter: function () {
      // don't open GDPR on static pages
      var pages = [];
      if (w.OTTera.cmsSettings.settings) {
        pages = w.OTTera.cmsSettings.settings.gdpr.blocked || [];
      }

      if (pages.indexOf(window.location.pathname) > -1) {
        return console.log("Blocking GDPR overlay for static page");
      }

      // check for gdpr cookie and pop footer
      var gdprAccept = w.OTTera.getCookie('ottGDPRAccept');
      if (!gdprAccept || !gdprAccept.length) {
        // only display on local or www
        if (window.location.host.search(/^(www|local)/) > -1) {
          w.OTTera.gdprFooterInterval = window.setInterval(w.OTTera.openGDPRFooter, 500);
        }
      }
    },

    openGDPRFooter: function () {
      if (w.OTTera.refs.modals.gdprFooter) {
        // kill the interval
        window.clearInterval(w.OTTera.gdprFooterInterval);

        w.OTTera.refs.modals.gdprFooter.removeClass('closed');

        // add a click event to close button to set the cookie
        $('.close-button', w.OTTera.refs.modals.gdprFooter).on('click', function () {
          w.OTTera.setCookie('ottGDPRAccept', '1', 365);
          w.OTTera.refs.modals.gdprFooter.addClass('closed');
        }.bind(this));
      }
      else {
        console.log('No gdpr modal loaded');
      }
    },

    /**
     * Give functions a chance to set request headers
     *
     * @param options
     */
    setDefaultHeaders: function(options) {
      w.OTTera.options.headers['ottera-referrer'] = options['ottera-referrer'] ? options['ottera-referrer'] : null;
      w.OTTera.options.headers['ottera-cs-auth'] = options['ottera-cs-auth'] ? options['ottera-cs-auth'] : null;
    },

    /**
     * Returns cleaned up version of origin domain for referrer header
     * @returns {string}
     */
    getReferrerHeader: function() {
      var host = window.location.hostname,
          regex = /([^.]+)\.(\w+)$/,
          matches = host.match(regex);

      return matches[matches.length - 2] + '.' + matches[matches.length - 1];
    },

    getRequestHeaders: function() {
      if (parseFloat(w.OTTera.params.version) < 13) return {};

      var headers = w.OTTera.options.headers;

      if (!headers['ottera-referrer']) {
        headers['ottera-referrer'] = w.OTTera.getReferrerHeader();
      }

      // TODO probably need a way to set this without the CMS attached
      if (!headers['ottera-cs-auth']) {
        if (w.OTTera.cmsSettings && w.OTTera.cmsSettings.settings &&
            w.OTTera.cmsSettings.settings.options && w.OTTera.cmsSettings.settings.options.cs_auth_token) {
          headers['ottera-cs-auth'] = w.OTTera.cmsSettings.settings.options.cs_auth_token;
        }
      }

      return headers;
    },

    /**
     * Displays an embedded player, authenticated with signature bypass as needed
     *
     * @param params
     */
    embedAuthenticatedPlayer: function(params) {
      var defaultEmbedParams = {
        device_type: this.detectDeviceType(),
        content_page_url: encodeURIComponent(window.location.href),
        language: 'en',
        platform: 'web',
        device_height: 720,
        device_width: 1280
      };

      var autoPlay = {
        desktop: (params.hasOwnProperty('auto_play') && params.auto_play.hasOwnProperty('desktop')) ? params.auto_play.desktop : true,
        mobile: (params.hasOwnProperty('auto_play') && params.auto_play.hasOwnProperty('mobile')) ? params.auto_play.mobile : true,
      };

      var requestParams = {
        id: parseInt(params.videoId, 10),
        div_id: params.hasOwnProperty('playerId') ? params.playerId : 'video_player',
        partner: params.hasOwnProperty('partner') ? params.partner : 'internal',
        player: params.hasOwnProperty('player') ? params.player : 'kt',
        "auto_play[desktop]": autoPlay.desktop,
        "auto_play[mobile]": autoPlay.mobile,
        // mute should be enabled when auto play is enabled
        mute: params.hasOwnProperty('mute') ? params.mute : (autoPlay.desktop === true || autoPlay.mobile === true),
        enable_floating: params.hasOwnProperty('enable_floating') ? params.enable_floating : false,
        preferred_bitrate: params.hasOwnProperty('preferred_bitrate') ? parseInt(params.preferred_bitrate, 10) : 1500,
        max_bitrate: params.hasOwnProperty('max_bitrate') ? parseInt(params.max_bitrate, 10) : 2500,
        auth_token: params.hasOwnProperty('auth_token') ? params.auth_token : this.getAuthToken(),
        preroll: params.hasOwnProperty('preroll') ? params.preroll : 0
      };

      if (params.hasOwnProperty('force_country_code')) {
        requestParams.force_country_code = params.force_country_code;
      }

      var mergedParams = $.extend({}, w.OTTera.params, defaultEmbedParams, requestParams);

      var url = w.OTTera.makeRequestUrl('embeddedVideoPlayer', mergedParams);

      if (w.date && w.date.plugin) {
        w.date.plugin('meridiem');
      }

      if (parseInt(w.OTTera.params.version, 10) >= 13) {
        var headers = {
          'ottera-referrer': this.getReferrerHeader(),
          'ottera-cs-auth': params.embedToken
        };

        w.OTTera.setDefaultHeaders(headers);

        $.ajax({
          url: url,
          method: 'get',
          headers: headers,
          success: function embeddedVideoPlayer(data) {
            var execPlayerEmbed = window.Function(data);
            execPlayerEmbed();
          }
        });
      } else {
        // v12 or earlier, use a script tag as we have til now

        var script = document.createElement('script');
        // Comment this out when you are done testing
        // script.onload = function () {
        //   console.log('Player script loaded');
        // };
        script.src = url;
        document.head.appendChild(script);
      }

      // EPG?
      if (params.epg && params.channelId) {
        $('#ottera-linear-epg--rail').show();

        w.OTTera.updateOtteraEPG('ottera-linear-epg', params.channelId);

        var position = params.epg;
        var epgPositions = ['bottom', 'right', 'left', 'top'];
        if (epgPositions.indexOf(params.epg) === -1) {
          position = 'bottom';
        }

        var containerId = params.containerId ? params.containerId : 'ottera-embed';

        var $embedContainer = $('#' + containerId);
        if ($embedContainer.length) {
          $embedContainer.addClass('epg-pos-' + position);
        }

        // refresh the EPG every 15 minutes
        w.OTTera.epgInterval = window.setInterval(w.OTTera.updateOtteraEPG.bind(this, 'ottera-linear-epg', params.channelId), (15 * 60 * 1000));

        $(window).on('beforeunload.epgtimer', function cleanUpEPGTimer() {
          window.clearInterval(w.OTTera.epgInterval);
        });

        window.addEventListener('message', function handleEPGMessages(event) {
          if (event.origin !== window.location.origin || undefined === event.data.name) {
            return;
          }

          if (event.data.name === 'ottera_epg_updated') {
            var epgItems = event.data.count;
            var epgItemWidth = 210;

            $('#ottera-linear-epg').css({
              width: ((epgItems + 1) * epgItemWidth) + "px"
            });
          }
        });
      }
    },

    /**
     * Set the cookie block
     *
     * @param bool blocked
     */
    setCookiedBlocked: function (blocked) {
      OTTera.cookiesBlocked = !!blocked;
    },

    /**
     * Has the user declined cookies?
     *
     * @param bool blocked
     */
    getCookiesBlocked: function () {
      return OTTera.cookiesBlocked;
    },

    /**
     *
     * Lightly modified from the HTML5 version
     *
     * @param baseString
     * @returns
     */
    convertStringPlaceholders: function(baseString) {
      if (baseString == null || baseString.length == 0) {
        return baseString;
      }

      // make sure the date-and-time meridiem plugin is initialized
      if (typeof w.date === 'object' || typeof w.date === 'function') {
        w.date.plugin('meridiem');
      }

      // JC Example
      // baseString = "::timestamp_1570485999_h:mm a:: - ::timestamp_1570486573_h:mm a::";
      var target = baseString.match(/::(.*?)::/g);
      if (target == null || target.length == 0) {
        return baseString;
      }
      for (var i = 0; i < target.length; i++) {
        var key = target[i];
        var item = key.replaceAll("::", "");
        var replacementString = item;
        if (item.indexOf("timestamp_") > -1) {
          var itemComps = item.split("_");
          if (itemComps != null && itemComps.length > 1) {
            var dateFormatString = "H:mm";
            if (itemComps.length > 2) {
              dateFormatString = itemComps[2];

              // the library used for date parsing expects uppercase D for day
              if (dateFormatString.indexOf('d') !== -1) {
                dateFormatString = dateFormatString.replace('d', 'D');
              }
            }
            var timestamp = parseInt(itemComps[1]);
            var dateObj = new Date(0);
            dateObj.setUTCSeconds(timestamp);

            // if the day and month has been included from the API, but it's the same day, remove them
            var monthDayRegex = /(M\/D|D\/M)\s*/; // M/D or D/M and optional spaces following
            if (dateFormatString.match(monthDayRegex)) {
              var dateToday = new Date();
              if (date.format(dateToday, 'M/D') === date.format(dateObj, 'M/D')) {
                // these match - strip the month/day formatter
                dateFormatString = dateFormatString.replace(monthDayRegex, '');
              }
            }

            // @see date-and-time library
            replacementString = date.format(dateObj, dateFormatString);
          }
        } else {
          replacementString = w.OTTera.translatePlaceholder(key);
        }
        baseString = baseString.replace(key, replacementString);
      }
      return baseString;
    },

    /**
     * Gets the timezone as an offset
     *
     * @returns string
     */
    getTimezone: function() {
      var timezoneOffset = (new Date()).getTimezoneOffset();
      var flipSign = false;
      if (timezoneOffset >= 0) {
        flipSign = true;
      }
      timezoneOffset = Math.abs(timezoneOffset);
      var hours = Math.floor(timezoneOffset / 60).toString();
      var minutes = Math.floor((timezoneOffset % 60)).toString();
      if (hours < 10) {
        hours = "0" + hours;
      }
      if (minutes < 10) {
        minutes = "0" + minutes;
      }
      if (flipSign === true) {
        return "-" + hours + minutes;
      } else {
        return hours + minutes;
      }
    }
  };

  w.OTTera.messageWindow("ottera_jslib_loaded", {});

  // w.OTTera.initialize();
};