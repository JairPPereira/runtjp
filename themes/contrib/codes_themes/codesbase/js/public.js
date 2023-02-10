(function ($) {
  'use strict';

  // are cookies blocked?
  var kCookiesBlocked = false;

  //This flag means that otteraEPGObjectClick has handled the event so otteraObjectClick don't need to handle it
  var epgClickHandled = false;

  var epgArr = [];

  // redirect plain node URLs to their canonical URL if possible
  // (account for /es/node/123 prefix as well as /node/123)
  var canonicalFind = window.location.pathname.search(/\/node\/\d+\/?$/);
  if (canonicalFind >= 0 && canonicalFind <= 3) {
    var canonicalHref = $(document).find('link[rel=canonical]').attr('href');

    if (canonicalHref && window.location.href !== canonicalHref) {
      window.location.href = canonicalHref;
    }
  }

  /**
   * Get the preferred language from the browser
   * @see https://www.npmjs.com/package/navigator-languages
   *
   * @returns array
   */
  function getNavigatorLanguages(){if('object'==typeof navigator){var c,a='anguage',b=navigator;return c=b['l'+a+'s'],c&&c.length?c:(a=b['l'+a]||b['browserL'+a]||b['userL'+a])?[a]:a}}

  // copied from jsLib, since we need it before that has loaded
  function otteraSetCookie(name, value, days, path, domain) {
    var expires = '',
      route = '/',
      samesite = 'SameSite=lax';

    domain = domain || '';

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

    window.document.cookie = name + '=' + (value || '')  + expires + route + domain + samesite;
  }

  // copied from jsLib, since we need it before that has loaded
  function otteraGetCookie(name) {
    var nameEQ = name + '=',
      ca = document.cookie.split(';');
    for(var i=0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1, c.length);
      }
      if (c.indexOf(nameEQ) === 0) {
        return c.substring(nameEQ.length, c.length);
      }
    }

    return null;
  }

  // copied from jsLib, since we need it before that has loaded
  function otteraDeleteCookie(name) {
    otteraSetCookie(name, null);
  }

  /**
   * Helper function, called early, that deletes as many first-party cookies
   * as possible if user declined them
   */
  function otteraRemoveMostCookies() {
    // delete all cookies we can
    var res = document.cookie;
    var multiple = res.split(";");

    // Set language cookie across *.example.com, so it will be available in checkout as well
    var cookieDomain = window.location.hostname.match(/\w+\.\w+$/);
    if (cookieDomain && cookieDomain.length) {
      cookieDomain = cookieDomain[0];
    } else {
      cookieDomain = window.location.hostname;
    }

    for(var i = 0; i < multiple.length; i++) {
      var key = multiple[i].split("=");
      document.cookie = key[0]+"=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + cookieDomain;
    }

    // except for the one that blocks cookies
    otteraSetCookie('ottGDPRAccept', 2, 365);
  }

  // if we're blocking cookies, do some early work
  if (otteraGetCookie('ottGDPRAccept') === '2') {
    otteraRemoveMostCookies();
  }

  // Add array support to jQuery.when
  if (typeof jQuery.when.all === 'undefined') {
    jQuery.when.all = function (deferreds) {
      return $.Deferred(function (def) {
        $.when.apply(jQuery, deferreds).then(
          function () {
            def.resolveWith(this, [Array.prototype.slice.call(arguments)]);
          },
          function () {
            def.rejectWith(this, [Array.prototype.slice.call(arguments)]);
          });
      });
    };
  }

  // add external search selector to root jQuery
  jQuery.expr[':'].external = function (obj) {
    if (!obj.href) {
      return false;
    }

    // These subdomains should not be processed as external links
    var skipSubdomains = ['account', 'account-ott', 'shop-ott', 'video', 'watch', 'www'];

    var hasInternalSubdomain;
    if (obj.hostname !== location.hostname) {
      hasInternalSubdomain = false;
      var objDomain = (obj.hostname ? obj.hostname.substring(obj.hostname.lastIndexOf('.', obj.hostname.lastIndexOf('.') - 1) + 1) : '');
      var locationDomain = location.hostname.substring(location.hostname.lastIndexOf('.', location.hostname.lastIndexOf('.') - 1) + 1);
      if (objDomain === locationDomain) {
        var objSubDomain = (obj.hostname ? obj.hostname.substring(0, obj.hostname.lastIndexOf('.', obj.hostname.lastIndexOf('.') - 1)) : '');
        if (objSubDomain) {
          if (skipSubdomains.includes(objSubDomain)) {
            hasInternalSubdomain = true;
          }
        }
      }
    }
    else {
      hasInternalSubdomain = true;
    }
    return obj.href.search(/^mailto:/) === -1 && obj.href.search(/^javascript:/) === -1 && (!hasInternalSubdomain) && (obj.href.search(/^http:/) !== -1 || obj.href.search(/^https:/) !== -1);
  };

  // disable all external links on COPPA sites
  if (drupalSettings.codesbasePublic.coppa) {
    $('a:external').each(function(i, el) {
      var $link = $(el);

      $link.addClass('external-preprocess');

      $link.data('external-href', $link.attr('href'));
      var currentTitle = $link.attr('title');
      $link.data('external-title', currentTitle ? currentTitle : "");
      $link.attr('href', '#');

      $link.attr('target', '_self');
      $link.attr('title', Drupal.t('Offsite links currently disabled'));
    });
  }

  // if we need a blocking language choice modal, show it right away
  // (need a custom modal since foundation isn't ready yet)
  var otteraEarlyModalId = 'ottera-modal-custom';
  if (drupalSettings.codesbasePublic.options.l10n && drupalSettings.codesbasePublic.options.l10n.switcher.force_choice === true) {
    // Set language cookie across *.example.com, so it will be available in checkout as well
    var cookieDomain = window.location.hostname.match(/\w+\.\w+$/);
    if (cookieDomain && cookieDomain.length) {
      cookieDomain = cookieDomain[0];
    } else {
      cookieDomain = window.location.hostname;
    }

    // first check the user's browser language, and refresh if needed
    if (!otteraGetCookie('ottera_lang')) {
      // if there's nothing in the path, check what the user's browser says
      var userLangs = getNavigatorLanguages();
      var defaultLanguage = (drupalSettings.codesbasePublic.options && drupalSettings.codesbasePublic.options.language) ? drupalSettings.codesbasePublic.options.language : 'en';
      var currentLanguage = defaultLanguage;

      if (userLangs.length > 0) {
        var preferredLang = userLangs[0];

        // trim en-US or the like to just en
        currentLanguage = preferredLang.split('-')[0].toLowerCase();

        otteraSetCookie('ottera_lang', currentLanguage, 30, '/', cookieDomain);

        // if the language is not the default, refresh
        if (currentLanguage !== defaultLanguage) {
          window.location.reload();
          return;
        }
      }
    }

    // If the cookie already exists, never mind
    if (!otteraGetCookie('ottera_lang_force')) {
      var img = $('#block-sitebranding').find('a').html();

      // show a language selector with a loading message/animation until we're actually ready
      var modalInner = '<div class="compulsory-language-switcher"><p style="max-width: 260px">'+img+'</p><p>' + Drupal.t('Choose your language') +'</p><div id="ottera-lang-modal-content">' + Drupal.t('Loading…') +'</div></div>';

      $('body').append('<div id="'+otteraEarlyModalId+'"><div class="modal-inner">'+modalInner+'</div></div>');

      otteraSetCookie('ottera_lang_force', 1, null, '/', cookieDomain);
    }
  }

  Drupal.behaviors.codesbasePublic = {
    settings: null,

    gdprFooterInterval: null,
    cookieDeclinedFooterInterval: null,
    externalLinkCountdownInterval: null,

    formModal: null,

    debug: {
      killLinear: false
    },

    gdprFooter: null,
    cookieDeclinedFooter: null,

    externalLinkModal: null,

    otteraContentRef: null,
    otteraContentRefId: 'ottera-content',

    otteraPlayerRef: null,
    otteraPlayerRefId: 'ottera-player',
    otteraPlayerLoadedIds: [],

    otteraSearchRef: null,
    otteraSearchRefId: 'ottera-search',
    otteraSearchKey: '',

    otteraBrowseRef: null,
    otteraBrowseRefId: 'ottera-browse',

    otteraLinearRef: null,
    otteraLinearRefId: 'ottera-linear-root',
    otteraLinearIsActive: false,
    otteraLinearCurrentChannel: null,
    otteraLinearCurrentVideo: null,

    // what section is being displayed right now?
    currentSection: null,

    datakeyLoadMore: 'ottera-load-more',
    dataKeyRowStyle: 'ottera-row-style',
    dataKeyIsLoading: 'is-loading',

    forwardToAccount: false,
    forwardToOrders: false,
    forwardToPayment: false,

    flickityOptions: {
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

    flickityOptionsSlider: {
      cellAlign: 'center',
      freeScroll: false,
      wrapAround: true,
      imagesLoaded: true,
      contain: true,
      pageDots: false,
      autoPlay: 5000 // TODO when this comes in configuration, reset
    },

    // flag that tracks whether fixing function has fired
    flickityFixed: false,

    otteraGroups: {},

    // languages we might use for translations
    translationLangs: ['en'],

    languageCookieName: 'ottera_lang',
    languageFormId: 'ottera-lang-choice',

    // the user's active permissions
    permissions: [],

    // various permissions strings we might see
    permissionStrings: {
      'premium': 'PR',
      'radio': 'RD',
      'registered': 'RU',
      'tvod': 'TVOD',
      'download': 'DL',
      'moderator': 'CM'
    },

    // cache some product data locally so we're not making a bajillion requests
    // on every page load (it disappears with every new page load)
    itemCache: {},
    productCache: {},
    cachePrefix: 'c',

    // Allow list of row styles we can render
    rowStyles: ['table', 'slider'],

    // Should we allow sections to load without page loads?
    // Some customers might not want this
    allowJsPageLoads: true,

    attach: function (context) {
      // load settings
      if (undefined !== drupalSettings.codesbasePublic) {
        this.settings = drupalSettings.codesbasePublic;
      }

      // Show the mobile install overlay if appropriate
      this.initMobileAppInstall();

      var language = this.getCurrentLanguage();

      this.setDebugParams();

      var postOTTeraJS = function(event) {
        if (event.origin !== window.location.origin || undefined == event.data.name) {
          return;
        }

        if (event.data.name === 'ottera_jslib_loaded') {
          // reload configuration if necessary
          if (OTTera.clearConfiguration && this.getUrlParameterByName('reload_config') == 1) {
            OTTera.clearConfiguration();
            var reloadUrl = this.replaceUrlParamValue('reload_config', 0, true);
            window.location.href = reloadUrl;
            return;
          }

          if (OTTera.setCMSSettings) {
            OTTera.setCMSSettings({
              settings: drupalSettings.codesbasePublic,
              partner: drupalSettings.codesPartner
            });
          }

          // initialize date-and-time plugin(s)
          if (window.date && window.date.plugin) {
            date.plugin('meridiem');
          }

          this.initOtteraPublic();

          window.removeEventListener('message', postOTTeraJS);
        }
      }.bind(this);

      window.addEventListener('message', postOTTeraJS);
    },

    /**
     * @backfilled
     */
    initOtteraPublic: function() {
      // set default params

      // setOptions and initialize the OTTera library
      var options = this.settings.options || OTTera.getOptions() || {};
      if (drupalSettings.codesPartner && drupalSettings.codesPartner.defaultRegcode) {
        if (drupalSettings.codesPartner.defaultRegcode.length) {
          options.regcode = drupalSettings.codesPartner.defaultRegcode;
        }
      }
      this.setDefaultOTTeraParams(options);

      // detect dark or light theme and set some classes
      if (window.tinycolor) {
        var bgColor = tinycolor(window.getComputedStyle(document.body).backgroundColor);
        var fgColor = tinycolor(window.getComputedStyle(document.body).color);

        // if we can be pretty sure about the brightness, set body class
        if (bgColor.getBrightness() > 128 && fgColor.getBrightness() <= 128) {
          // light
          document.body.classList.add('body-light');
        } else if (fgColor.getBrightness() > 128 && bgColor.getBrightness() <= 128) {
          // dark
          document.body.classList.add('body-dark')
        } else {
          // can't tell, or everything's medium gray?
        }
      }

      // hide the upgrade link if cookie set
      var hideUpgrade = this.getUrlParameterByName('hide_upgrade', window.location.href);
      if(OTTera.getCookie('ottHideUpgrade')) {
        // if we are on the home page and no param is set
        // then delete the cookie
        if(window.location.pathname === '/' && !hideUpgrade) {
          OTTera.setCookie('ottHideUpgrade', null);
        }
        else {
          this.hideUpgradeLink();
        }
      }
      else {
        if(hideUpgrade && hideUpgrade == '1') {
          this.hideUpgradeLink();
          OTTera.setCookie('ottHideUpgrade', '1', 365);
        }
      }

      // set up where ottera content will go (only on home page for now)
      // TODO this should probably be configurable
      var $main = $('#ottera-js-root');
      if ($main.length > 0) {
        $main.append('<div id="' + this.otteraPlayerRefId + '"></div>')
          .append('<div id="' + this.otteraContentRefId + '"></div>');
      }

      // set up where ottera search content will go
      // TODO this should probably be configurable
      var $searchMain = $('#ottera-js-root--search');
      if ($searchMain.length > 0) {
        $searchMain.append('<div id="' + this.otteraSearchRefId + '"></div>');
      }

      // set up where ottera browse content will go
      // TODO this should probably be configurable
      var $browseMain = $('#ottera-js-root--browse');
      if ($browseMain.length > 0) {
        $browseMain.append('<div id="' + this.otteraBrowseRefId + '"></div>');
      }

      // add the products
      this.$products = $('#products').length ? $('#products') : null;

      this.initModals();

      // hook clicks against the login event
      $('a[href$="#login"]').on('click', function (e) {
        e.preventDefault();

        if (!window.OTTera.isAuthenticated()) {
          Drupal.behaviors.codesbasePublic.loadLoginForm();
        }
        else {
          window.OTTera.logout();
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
      $leftOffCanvas.on('click', function (evt) {
        var $target = $(evt.target);
        if ($target.is('a') || $target.is('button')) {
          // links and buttons in the menu can be handled normally
        } else {
          // other clicks close the menu
          $(this).foundation('close');
        }
      });

      // add vertical class to the left side/mobile nav block
      $leftOffCanvas.find('.block-mainnavigation').addClass('vertical');

      this.showInstallAndroidApp();

      this.setExternalLinkTargets();

      // check to see if there is a currentSection flag set in the options
      // this is a single page linear player and needs to fallback set since there is no waterfall
      if('undefined' !== typeof(options.currentSection)) {
        this.currentSection = options.currentSection;
      }

      // add event listener for messages coming in
      window.addEventListener('message', function (event) {
        if (undefined != event.data.name) {

          // if forms loaded open modal
          if (event.data.name.indexOf('form_loaded') > 0) {
            // don't pop for regcode form since it is inline
            if (event.data.name !== 'ottera_regcode_form_loaded') {
              Drupal.behaviors.codesbasePublic.openFormModal();
            }
          }

          switch (event.data.name) {
            case 'ottera_initialized':
              if (this.isApparentlyiOS()) {
                this.hideiOSHideables();
              }

              var $body = $('body');

              this.toggleBodyClasses();

              var site_prefix = this.settings.site_prefix ? this.settings.site_prefix : '';
              // Some customers are better served with a back button (if they have lots of sections, e.g.)
              this.allowJsPageLoads = ['slc'].indexOf(site_prefix) === -1;

              // see if the modal language selector is open, and update if so
              var $modalLangChoice = $('#ottera-lang-modal-content');
              if ($modalLangChoice.length) {
                var langForm = this.getLanguageSelectorWidget();

                $modalLangChoice.html(langForm);

                var eventType = 'submit';
                if (this.settings.options.l10n && this.settings.options.l10n.switcher.widget) {
                  if (this.settings.options.l10n.switcher.widget === 'select') {
                    $('#'+this.languageFormId).on('submit', Drupal.behaviors.codesbasePublic.activateLanguageChoice.bind(this));
                  } else {
                    $('.ottera-lang-select').on('click', Drupal.behaviors.codesbasePublic.activateLanguageChoice.bind(this));
                  }
                }
              }

              console.log("Event data ottera_initialized", event.data);
              // TODO check for upgrade path
              //  add regcode form
              if ($('#regcode-wrapper').length) {
                window.OTTera.loadFormOnPage({
                  id: 'regcode',
                  div_id: 'regcode-wrapper',
                  div_id_login: 'ottera-modal-inner'
                });
              }

              // if there's a default products ref
              if (Drupal.behaviors.codesbasePublic.$products) {
                // reset the html in case there is any garbage inside
                Drupal.behaviors.codesbasePublic.$products.html('');

                var products = OTTera.getProducts();
                if (products.length) {
                  for (var x in products) {
                    // TODO skip anything that's not a subscription
                    // purchase_type === subscription
                    var product = products[x];
                    if (product.purchase_type !== 'subscription') {
                      continue;
                    }

                    var term = product.term.replace('per ', '');
                    var sku_a = product.sku.split('.');
                    var trial = false;
                    for (var y in sku_a) {
                      var m = sku_a[y].match(/trial|t[0-9]/g);
                      if (m && m.length) {
                        // crappy override for additional skus that use "t" and not "trial
                        trial = sku_a[y].replace('t', '');
                        trial = trial.replace('rial', '');
                      }

                    }

                    var productBtnLabel = product.price + " / " + term;
                    if (trial && trial !== "0") {
                      productBtnLabel = term.replace('-', ' ');
                      if (productBtnLabel.search(/free/i) === -1) {
                        productBtnLabel = productBtnLabel.replace(' trial', ' free trial');
                      }
                    } else {
                      productBtnLabel = product.price + " " + product.term;

                      if (!product.note) {
                        product.note = Drupal.t("Then @price/@term", {
                          '@price' : product.price,
                          '@term' : term,
                        });
                      }
                    }

                    var productTemplate = "<div class='small-12 medium-6 columns align-center'>\n" +
                      "<div class='product' id='product--"+product.sku.replace(/\./g, '-')+"'>\n" +
                      "<p><span class='product--name'>"+(product.name ? product.name : '')+"</span><a class='button upgrade' data-product='" + product.sku + "' href='/upgrade'>" + productBtnLabel + "</a></p>\n";

                    if (undefined != product.note && product.note.length) {
                      productTemplate += "<p class='product--note'>" + product.note + "</p>\n";
                    }

                    productTemplate += "<p class='product--note'>" + Drupal.t('cancel anytime') +"</p>\n" +
                      "</div>\n" +
                      "</div>\n";

                    Drupal.behaviors.codesbasePublic.$products.append(productTemplate);
                  }
                }

                $('a.upgrade').on('click', Drupal.behaviors.codesbasePublic.handleUpgradeClick);
              }
              $body.trigger('OTTera_products_ready');

              // handle upgrade buttons in custom upgrade areas
              var $customUpgradeRegion = $('.upgrade--has-buttons');
              if ($customUpgradeRegion.length) {
                $customUpgradeRegion.find('a.upgrade').on('click', Drupal.behaviors.codesbasePublic.handleUpgradeClick);
              }

              var regcode = this.getActiveRegcode();

              if (this.otteraIsPremiumUser()) {
                Drupal.behaviors.codesbasePublic.hideUpgradeLink();
              }
              else if (window.OTTera.isAuthenticated()) {
                // put authenticated users straight through to checkout
                if (regcode && regcode.length) {
                  this.upgrade({regcode: regcode});
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
              var $contentRef = $('#' + this.otteraContentRefId);
              this.otteraContentRef = $contentRef.length ? $contentRef : null;

              var $playerRef = $('#' + this.otteraPlayerRefId);
              this.otteraPlayerRef = $playerRef.length ? $playerRef : null;

              this.loadRequestedModal();

              // if there's a place to put OTTera content, initialize some more
              if (this.otteraContentRef) {
                this.otteraContentRef.on('click', '.ottera-link-select', this.otteraObjectClick.bind(this));
                this.otteraContentRef.on('click', '.ottera--epg--info', this.otteraEPGObjectClick.bind(this));

                if (this.allowJsPageLoads) {
                  // Make home links use JS instead of full page loads
                  $('a[href="/"]').not('.toolbar-item').click(this.otteraShowHomeJS.bind(this));
                  // (including home links that show the app path)
                  $('a[href="/app"]').not('.toolbar-item').click(this.otteraShowHomeJS.bind(this));

                  // wire up section links so they use JS too
                  var $mainMenus = $('ul.block-mainnavigation');
                  $mainMenus.find('a[href*="?section="]').on('click', function(evt) {
                    evt.preventDefault();

                    $mainMenus.find('a').removeClass('is-active');

                    var $link = $(evt.currentTarget);
                    var sectionName = this.getUrlParameterByName('section', $link.attr('href'));
                    this.otteraShowSection(sectionName);
                    $link.addClass('is-active');
                  }.bind(this));
                }

                this.otteraContentRef.on('init-carousels', this.initCarousels.bind(this));

                // Redirect if we have one, otherwise load the desired section
                var hasRedirected = this.loadRedirectByUrl();
                if (!hasRedirected) {
                  this.loadSectionByUrl();
                  this.loadCollectionByUrl();
                }
              }

              var $searchRef = $('#' + this.otteraSearchRefId);
              this.otteraSearchRef = $searchRef.length ? $searchRef : null;
              if (this.otteraSearchRef) {
                this.initOtteraSearch();
              }

              var $browseRef = $('#' + this.otteraBrowseRefId);
              this.otteraBrowseRef = $browseRef.length ? $browseRef : null;
              if (this.otteraBrowseRef) {
                this.initOtteraBrowse();
              }

              var $linearRef = $('#' + this.otteraLinearRefId);
              this.otteraLinearRef = $linearRef.length ? $linearRef : null;
              if (this.otteraLinearRef) {
                if(this.currentSection) {
                  var sectionName = this.currentSection;
                  var selectedSections = window.OTTera.configuration.sections.filter(function(s) {
                    if (s && s.section) {
                      return s.section === sectionName;
                    }
                  });
                  if(selectedSections.length > 0) {
                    var selectedSection = selectedSections[0];
                    // check if we are in a section that has allowed_linear_channel_ids
                    if (selectedSection.allowed_linear_video_ids) {
                      this.initOtteraLinear({
                        videoId: selectedSection.allowed_linear_video_ids[0],
                        channelId: 'lookup',
                      });
                    } else {
                      this.initOtteraLinear();
                    }
                  }
                }
                else {
                  this.initOtteraLinear();
                }
              }

              var isCollection = $body.hasClass('node-type-collection');
              if (isCollection) {
                this.renderCollectionPage();
              }

              this.addAndChangeLinks();

              this.setLocaleOverrides();

              var accessCheckClass = '.ottera-access-check';
              this.setupAccessChecks(accessCheckClass);

              // wire up the contact link that might have been added
              $('a[href$="#contact"]').on('click', function (e) {
                e.preventDefault();

                this.loadContactForm();

                return false;
              }.bind(this));

              // get the embedded players ready
              var playerTriggerClass = '.click-to-play',
                $playerTriggers = $(playerTriggerClass);
              if ($playerTriggers.length > 0) {
                this.setupEmbeddedPlayers(playerTriggerClass);
              }

              // add behaviors for collections
              if ($body.hasClass('node-type-collection')) {
                this.setupCollection();
              }

              // add behaviors for shows
              if ($body.hasClass('node-type-show')) {
                this.setupShow();
              }

              // add behaviors for shows
              if ($body.hasClass('node-type-video')) {
                this.setupVideo();
              }

              // add behaviors for static pages
              if ($body.hasClass('page-static')) {
                this.setupStaticPages();
              }

              // update any rendered links that need dynamic params
              this.updateAPIParams();

              // initialize COPPA measures if needed
              this.initCOPPA();

              // Set up any OTTera item blocks
              this.renderOTTeraItemBlocks();

              var resizeThrottle;
              $(window).resize(function (evt) {
                clearTimeout(resizeThrottle);
                resizeThrottle = setTimeout(this.otteraResize, 250);
              }.bind(this));
              this.otteraResize();

              break;

            case 'ottera_authenticated':
              // set the auth_token
              console.log("Event data ottera_authenticated", event.data);
              OTTera.setCookie('ottAuthToken', event.data.auth_token, 365);

              $('a[href$="#login"]').each(function () {
                $(this).html(Drupal.t('Log out'));
              });

              Drupal.behaviors.codesbasePublic.closeFormModal();

              // check if we are flagged to redirect to account domain
              if(Drupal.behaviors.codesbasePublic.forwardToAccount) {
                // set the flag back to false
                Drupal.behaviors.codesbasePublic.forwardToAccount = false;
                return Drupal.behaviors.codesbasePublic.makeRequest('redirect', {location: 'account', 'dest_url': window.location.href });
              }
              else if(Drupal.behaviors.codesbasePublic.forwardToOrders) {
                // set the flag back to false
                Drupal.behaviors.codesbasePublic.forwardToOrders = false;
                return Drupal.behaviors.codesbasePublic.makeRequest('redirect', {location: 'orders', 'dest_url': window.location.href });
              }
              else if(Drupal.behaviors.codesbasePublic.forwardToPayment) {
                // set the flag back to false
                Drupal.behaviors.codesbasePublic.forwardToPayment = false;
                return Drupal.behaviors.codesbasePublic.makeRequest('redirect', {location: 'payment', 'dest_url': window.location.href });
              }

              // we should refresh on login unless we're on an upgrade page,
              // or otherwise have a regcode to test
              var shouldRefreshNow = window.location.pathname.search('/upgrade') !== -1 || !(regcode && regcode.length);
              if (shouldRefreshNow) {
                // reload the page
                window.location.reload();
                return;
              }

              if (this.settings.commerce !== false) {
                if (!this.otteraVersionAtLeast(14)) {
                  if (!this.otteraIsPremiumUser()) {
                    // if the user isn't a premium user, but does have a regcode available,
                    // send through checkout
                    if (regcode && regcode.length) {
                      this.upgrade({regcode: regcode});
                    }
                  }
                  else {
                    Drupal.behaviors.codesbasePublic.hideUpgradeLink();

                    // hide overlays on videos for premium users
                    var $videoNode = $('.node--video');
                    if ($videoNode.length) {
                      $videoNode.find('.premium-message').fadeOut('fast');
                    }
                  }
                } else {
                  // TODO Commerce (tvod, subscriptions) is on and we have a logged in user - now what?
                  this.saveUserPermissions();

                }
              }
              break;

            case 'ottera_registered':
              // set the auth_token
              console.log("Event data ottera_registered", event.data);
              OTTera.setCookie('ottAuthToken', event.data.auth_token, 365);

              $('a[href$="#login"]').each(function () {
                $(this).html(Drupal.t('Log out'));
              });

              Drupal.behaviors.codesbasePublic.closeFormModal();

              if (this.settings.commerce !== false) {
                //TODO Move this to version 14.0 once ELEC:EN rolls up
                if (Drupal.behaviors.codesbasePublic.forwardToPayment) {
                  // set the flag back to false
                  Drupal.behaviors.codesbasePublic.forwardToPayment = false;
                  return Drupal.behaviors.codesbasePublic.makeRequest('redirect', {
                    location: 'payment',
                    'dest_url': window.location.href
                  });
                }

                if (!this.otteraVersionAtLeast(14)) {
                  // if a default regcode is available then put through checkout
                  if (drupalSettings.codesPartner && drupalSettings.codesPartner.defaultRegcode) {
                    if (drupalSettings.codesPartner.defaultRegcode.length) {
                      this.upgrade({regcode: drupalSettings.codesPartner.defaultRegcode});
                    }
                  }
                  // newly register user has no permission so forward to upgrade
                  else if (window.location.pathname === '/upgrade') {
                    // if we are already on the upgrade path then check for regcode
                    // and redirect to checkout if present
                    if (regcode && regcode.length) {
                      this.upgrade({regcode: regcode});
                    }
                  }
                } else {
                  // Newly registered user with TVOD available
                  // Refresh so we get updates to permissions on what we're viewing
                  window.location.reload();
                  return;
                }
              } else {
                window.OTTera.clearConfiguration();
                window.location.reload();
              }
              break;

            case 'ottera_feedback_received':
              console.log("Event data ottera_feedback_received", event.data);
              Drupal.behaviors.codesbasePublic.closeFormModal();
              alert(Drupal.t('Feedback received'));
              break;

            case 'ottera_logout':
              console.log("Event data ottera_logout", event.data);
              $('a[href$="#login"]').each(function () {
                $(this).html(Drupal.t('Login/Register'));
              });

              // delete the cookie
              OTTera.deleteCookie('ottAuthToken');

              // reload the page
              window.location.reload();
              break;

            case 'ottera_ad_started':
            case 'ottera_player_loaded':
              // when the player is loaded, look for links
              this.initCOPPA({timeout1: 250, timeout2: 500});
              break;
          }
        }
      }.bind(this), false);

      // TODO add event listeners for state changes
      /*
      window.addEventListener('popstate', function(evt) {
        var state = evt.state;

        // this.loadSectionByUrl();
        // this.loadCollectionByUrl();

        if (state.searchKey && state.searchKey !== this.otteraSearchKey && this.otteraSearchRef) {
          this.initOtteraSearch();
        }
      }.bind(this));
      */

      // check if already logged in
      var authToken = OTTera.getCookie('ottAuthToken');
      if (authToken && authToken.length) {
        $('a[href$="#login"]').each(function () {
          $(this).html(Drupal.t('Log out'));
        });
      }

      // set up JS for static show pages
      this.initShowPage();

      OTTera.setOptions(options);
      OTTera.initialize();

      // finally pop the GDPR modal if needed
      this.initGDPRFooter();
    },

    initGDPRFooter: function () {
      // don't open GDPR on static pages
      var pages = [];
      if (this.settings) {
        pages = this.settings.gdpr.blocked || [];
      }

      if (pages.indexOf(window.location.pathname) > -1) {
        console.log("Blocking GDPR overlay for static page");
        return;
      }

      var isOTTeraHost = window.location.host.search(/^(shop|account|internal)/) !== -1;

      // check for gdpr cookie and pop footer
      var gdprAccept = OTTera.getCookie('ottGDPRAccept');
      if (!gdprAccept || !gdprAccept.length) {
        // Hide from internal hostnames
        if (!isOTTeraHost && this.openGDPRFooter) {
          this.gdprFooterInterval = window.setInterval(this.openGDPRFooter.bind(this), 500);
        }
      }

      if (gdprAccept === '2') {
        this.updateCookiedItems(true);

        // only display on local or www
        if (!isOTTeraHost && this.openCookieDeclinedFooter) {
          this.cookieDeclinedFooterInterval = window.setInterval(this.openCookieDeclinedFooter.bind(this), 500);
        }
      }
    },

    /**
     * @backfilled
     */
    initModals: function() {
      // add all modals
      Drupal.behaviors.codesbasePublic.gdprFooter = $('#gdpr-footer').length ? $('#gdpr-footer') : null;
      Drupal.behaviors.codesbasePublic.cookieDeclinedFooter = $('#cookies-declined').length ? $('#cookies-declined') : null;
      Drupal.behaviors.codesbasePublic.formModal = $('#ottera-modal').length ? $('#ottera-modal') : null;
      Drupal.behaviors.codesbasePublic.externalLinkModal = $('#external-modal').length ? $('#external-modal') : null;
    },

    /**
     * @backfilled
     */
    openFormModal: function () {
      if (Drupal.behaviors.codesbasePublic.formModal) {
        Drupal.behaviors.codesbasePublic.formModal.foundation('open');
        // ensure to close the sidebar
        $('#left-off-canvas .close-button').trigger('click');

        // make sure any intervals are cleared
        $('.close-button').on('click.modalClose', function () {
          window.clearInterval(Drupal.behaviors.codesbasePublic.externalLinkCountdownInterval);
        }.bind(this));
      }
      else {
        console.log('No form modal loaded');
      }
    },

    closeFormModal: function () {
      window.clearInterval(Drupal.behaviors.codesbasePublic.externalLinkCountdownInterval);

      if (Drupal.behaviors.codesbasePublic.formModal) {
        Drupal.behaviors.codesbasePublic.formModal.foundation('close');
      }
      else {
        console.log('No form modal loaded');
      }
    },


    /**
     * @backfilled
     */
    openGDPRFooter: function () {
      if (this.gdprFooter) {
        // kill the interval
        window.clearInterval(this.gdprFooterInterval);

        this.gdprFooter.removeClass('closed');

        // add a click event to close button to set the cookie
        $('.close-button', Drupal.behaviors.codesbasePublic.gdprFooter).on('click', function () {
          OTTera.setCookie('ottGDPRAccept', 1, 365);
          this.updateCookiedItems(false);
          this.gdprFooter.addClass('closed');
        }.bind(this));

        // add a click event to close button to set the cookie
        $('#link-gdpr-cookie-decline', Drupal.behaviors.codesbasePublic.gdprFooter).on('click', function () {
          OTTera.setCookie('ottGDPRAccept', 2, 365);
          this.updateCookiedItems(true);
          this.gdprFooter.addClass('closed');
          this.openCookieDeclinedFooter();
        }.bind(this));
      }
      else {
        console.log('No gdpr modal loaded');
      }
    },

    /**
     * Open the separate, fixed footer that comes up when cookies are declined
     */
    openCookieDeclinedFooter: function() {
      if (Drupal.behaviors.codesbasePublic.cookieDeclinedFooter) {
        // kill the interval
        window.clearInterval(Drupal.behaviors.codesbasePublic.cookieDeclinedFooterInterval);

        Drupal.behaviors.codesbasePublic.cookieDeclinedFooter.removeClass('closed');

        // add a click event to close button to set the cookie
        $('.close-button', this.cookieDeclinedFooter).on('click', function () {
          this.updateCookiedItems(false);
          OTTera.setCookie('ottGDPRAccept', 1, 365);
          this.cookieDeclinedFooter.addClass('closed');
        }.bind(this));

        $('.close-button-x', this.cookieDeclinedFooter).on('click', function () {
          this.cookieDeclinedFooter.addClass('closed');
        }.bind(this));
      }
      else {
        console.log('No cookie declined modal loaded');
      }
    },

    /**
     * Respond to cookies being declined, or re-enabled.
     *
     * Delete any cookies we can, hide items that would require cookies
     *
     * @param cookiesBlocked
     */
    updateCookiedItems: function(cookiesBlocked) {
      kCookiesBlocked = !!cookiesBlocked;

      // pass cookie block to the API, if ready
      if (window.OTTera.setCookiedBlocked) {
        window.OTTera.setCookiedBlocked(kCookiesBlocked);
      }

      var hideables = [
        $('a[href$="#login"]'),
        $('a[href$="#account"]'),
        $('a[href$="/upgrade"]')
      ];

      for (var i = 0; i < hideables.length; i++) {
        var $item = hideables[i];
        if (!$item.length) continue;

        if (!kCookiesBlocked) {
          $item.show();
        } else {
          $item.hide();
        }
      }

      // other things to do when cookies are blocked
      if (kCookiesBlocked) {
        otteraRemoveMostCookies();
      }
    },

    openExternalLinkModal: function (link) {
      if (Drupal.behaviors.codesbasePublic.externalLinkModal) {
        $('iframe', Drupal.behaviors.codesbasePublic.externalLinkModal).attr('src', link.attr('href'));

        Drupal.behaviors.codesbasePublic.externalLinkModal.foundation('open');
      }
      else {
        console.log('No external link modal loaded');
      }
    },

    /**
     * @backfilled
     */
    hideUpgradeLink: function () {
      $('ul.block-mainnavigation a[href="/upgrade"]').hide();
    },

    /**
     * @backfilled
     */
    showInstallAndroidApp: function() {
      // disable this if the page is set with an android FLAG on the body class
      // this means we are in an android web view within the app and not on mobile web
      if($('body').hasClass('platform-android')) {
        return;
      }

      if (/Android/i.test(navigator.userAgent) && this.settings.devices.android && this.settings.devices.android.url) {
        // add cookie gate?
        // if (OTTera.getCookie('android-install'))

        var androidHtml = '<div class="install-android"><div class="install-android--icon"><a href="'+ this.settings.devices.android.url +'"></a></div><div class="install-android--copy"><h4 class="install-android--copy--header">Install the '+ this.settings.site_name +' app</h4><a class="install-android--button" href="'+ this.settings.devices.android.url +'"><img src="/themes/contrib/codes_themes/codesbase/images/devices/google-play.png" alt="Get the app on Google Play"></a></div><button class="install-android--close">˟</button></div>';

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

    /**
     * @backfilled
     */
    doesPageExist: function(page) {
      var settings = Drupal.behaviors.codesbasePublic.settings;
      if (settings && undefined !== settings.pages && undefined !== settings.pages[page]) {
        return true;
      }

      return false;
    },

    /**
     * Adds Account and other JS-powered links to the pages
     *
     * @backfilled
     */
    addAndChangeLinks: function () {
      var $footerMenu = $('.footer-menu');
      var mainUrl = this.settings.main_url ? this.settings.main_url : this.getMainHostFallback();

      // On local environment, always use the fallback
      if (this.isLocal()) {
        mainUrl = this.getMainHostFallback();
      }

      // force rooted nav links in the sidebars, header, and footer to use site_main_url
      if ($footerMenu.length) {
        $footerMenu.find('a[href^="/"]').each(function(i, el) {
          var $link = $(el);
          var href = $link.attr('href');
          $link.attr('href', mainUrl + href);
        }.bind(this));
      }

      $('#left-off-canvas, .block-mainnavigation').find('a[href^="/"]').each(function(i, el) {
        var $link = $(el);
        var href = $link.attr('href');
        $link.attr('href', mainUrl + href);
      }.bind(this));

      // only do the rest if we're on the main
      if (!this.isMainDomain()) {
        return;
      }

      // add account link if the user is logged in
      if (this.otteraIsLoggedInJS() && Drupal.behaviors.codesbasePublic.doesPageExist('account')) {
        var title = Drupal.t('Account');

        // run through the OTTera translator too
        title = window.OTTera.translatePlaceholder(title);

        $('ul.block-mainnavigation').each(function() {
          // Only add if it's not there already
          var $existingAccount = $(this).find('a[href$="#account"]');
          var $existingAccountText = $(this).find('a:contains("Account")', 'a:contains("account")');

          if (!$existingAccount.length && !$existingAccountText.length) {
            $(this).append('<li role="menuitem"><a href="/#account">' + title + '</a></li>');
          }
        });

        // add click and hide
        var $accountLink = $('a[href="/#account"]', 'ul.block-mainnavigation');
        $accountLink.on('click', function(){
          var location = (undefined !== Drupal.behaviors.codesbasePublic.settings.pages.account.path) ? Drupal.behaviors.codesbasePublic.settings.pages.account.path : 'account';
          // sanitize the location to one of these allowed values
          if (['account', 'orders', 'order'].indexOf(location) === -1) {
            location = 'account';
          }

          if (!window.OTTera.isAuthenticated()) {
            if (location === 'orders' || location === 'order') {
              Drupal.behaviors.codesbasePublic.forwardToOrders = true;
            }
            else {
              Drupal.behaviors.codesbasePublic.forwardToAccount = true;
            }

            Drupal.behaviors.codesbasePublic.loadLoginForm();
          }
          else {
            Drupal.behaviors.codesbasePublic.makeRequest('redirect', {
              location: location,
              'dest_url': window.location.href
            });
          }

          return false;
        });
      }

      // add search link
      if (Drupal.behaviors.codesbasePublic.doesPageExist('search')) {
        this.initOTTeraSearchHeader();
      }

      // add contact link, if needed
      if (window.OTTera.configuration.forms && typeof window.OTTera.configuration.forms.feedback === 'object') {
        var $existingContact = $footerMenu.find('a[href$="#contact"]');
        var $existingContactText = $footerMenu.find('a:contains("Contact")', 'a:contains("contact")');

        var contactTitle = Drupal.t('Contact');
        contactTitle = window.OTTera.translatePlaceholder(contactTitle);

        if (!$existingContact.length && !$existingContactText.length) {
          $footerMenu.append('<li><a href="/#contact">'+ contactTitle +'</a></li>');
        }
      }

      // Possibly modify the name of the home link
      // if there is a section called home and it has a title set
      if (window.OTTera.configuration.sections[0] && window.OTTera.configuration.sections[0].section === 'home' && window.OTTera.configuration.sections[0].title) {
        var updatedTitle = OTTera.translatePlaceholder(window.OTTera.configuration.sections[0].title);

        // if the new title is empty, or a placeholder, skip
        if (updatedTitle && updatedTitle.indexOf('::') !== 0) {
          $('ul.block-mainnavigation').find('[href="/"],[href="/app"]').each(function(i, el) {
            if ($(el).text().toLowerCase() === 'home') {
              $(el).text(updatedTitle);
            }
          });
        }
      }
    },

    /**
     * If a site happens not to have a main URL set, get a fallback value
     *
     * @returns {string}
     */
    getMainHostFallback: function() {
      // if we can't get a main URL from settings, pull it from the URL
      var currentHost = window.location.hostname;
      var mainUrlHost = window.location.hostname;

      var replaceSlug = 'www.';
      if (this.isLocal()) {
        replaceSlug = '';
      }

      if (currentHost.indexOf('account.') > -1) {
        mainUrlHost = currentHost.replace('account.', replaceSlug);
      } else if (currentHost.indexOf('account-ott.') > -1) {
        mainUrlHost = currentHost.replace('account-ott.', replaceSlug);
      } else if (currentHost.indexOf('shop.') > -1) {
        mainUrlHost = currentHost.replace('shop.', replaceSlug);
      } else if (currentHost.indexOf('shop-ott.') > -1) {
        mainUrlHost = currentHost.replace('shop-ott.', replaceSlug);
      }

      return location.origin.replace(currentHost, mainUrlHost);

    },

    /**
     * Do we appear to be on an iOS devices?
     * @returns {boolean}
     */
    isApparentlyiOS: function() {
      return /iPhone|iPad|iPod|AppleTV/i.test(navigator.userAgent);
    },

    /**
     * Helper function that hides stuff that should not be displayed on iOS
     * devices
     */
    hideiOSHideables: function() {
      // devices link from header and mobile slideover menu
      $('#meta-header-wrapper').find('a[href*=devices]').hide();
      $('#left-off-canvas').find('a[href*=devices]').hide();

      // Hide all links from the device footer except for Apple
      var $devicesBlock = $('#block-devices');
      if ($devicesBlock.length) {
        $devicesBlock.find('a').not('[href*="apple.com"]').parentsUntil('.row').hide();
      }

      // Same for the programmatic block
      var $newDevicesBlock = $('.block-devices');
      if ($newDevicesBlock.length) {
        $newDevicesBlock.find('a').not('[href*="apple.com"]').parentsUntil('.row').hide();

        // other partners also hidden
        $newDevicesBlock.find('.other').hide();
      }
    },

    /**
     * @backfilled
     */
    loadLoginForm: function () {
      this.clearFormModal();

      window.OTTera.loadFormOnPage({
        id: 'login',
        div_id: 'ottera-modal-inner'
      });
    },

    /**
     * Loads the register form
     */
    loadRegisterForm: function () {
      this.clearFormModal();

      window.OTTera.loadFormOnPage({
        id: 'register',
        div_id: 'ottera-modal-inner'
      });
    },

    /**
     * @backfilled
     */
    loadContactForm: function () {
      this.clearFormModal();

      window.OTTera.loadFormOnPage({
        id: 'feedback',
        div_id: 'ottera-modal-inner'
      });
    },

    /**
     * Handle checkout buttons on upgrade pages
     *
     * @param e
     * @returns {boolean|void}
     */
    handleUpgradeClick: function(e) {
      e.preventDefault();

      // if we aren't logged in we need to pop the form
      if (!window.OTTera.isAuthenticated()) {
        return Drupal.behaviors.codesbasePublic.loadLoginForm();
      }

      var product = $(this).attr('data-product');
      if (product.length) {
        Drupal.behaviors.codesbasePublic.upgrade({products: product});
      }

      return false;
    },

    /**
     * @backfilled
     */
    loadRequestedModal: function() {
      // if we're trying to open a modal immediately, do it
      var openParam = this.getUrlParameterByName('open');
      if (openParam) {
        switch (openParam) {
          case 'contact' :
            this.loadContactForm();
            break;
          case 'login' :
            // don't pop this if you're already logged in
            if (!this.otteraIsLoggedInJS()) {
              this.loadLoginForm();
            }
            break;
          case 'register' :
            // don't pop this if you're already logged in
            if (!this.otteraIsLoggedInJS()) {
              this.loadRegisterForm();
            }
            break;
        }
      }

      return true;
    },

    /**
     * Allow overrides of country and language when appropriate
     */
    setLocaleOverrides: function() {
      // load country from the query string
      var countryParam = this.getUrlParameterByName('force_country_code');
      if (countryParam) {
        window.OTTera.params.force_country_code = countryParam;
        window.OTTera.params.debug = 1;
        window.OTTera.setCookie('force_country_code', countryParam);
      }

      // If we're using a configuration object:
      this.translationLangs = (window.OTTera.configuration.services && window.OTTera.configuration.services.general && window.OTTera.configuration.services.general.translations && window.OTTera.configuration.services.general.translations.languages) ? window.OTTera.configuration.services.general.translations.languages : ['en'];
      this.settings.available_languages = this.translationLangs;

      // if we DON'T have a language cookie but we DO have a query param,
      // set the default language from the param
      if (!otteraGetCookie(this.languageCookieName) && this.getUrlParameterByName('language')) {
        var queryLang = this.getUrlParameterByName('language');

        if (this.translationLangs.indexOf(queryLang) >= 0) {
          var cookieDomain = this.getCookieDomain();
          otteraSetCookie(this.languageCookieName, queryLang, 30, '/', cookieDomaink);
        }
      }

      // If we're just letting Drupal tell us what languages are available
      // this.translationLangs = this.settings.available_languages;

      // if the switcher should be enabled, and we actually have enough languages to switch among...
      if (this.settings.options.hasOwnProperty('l10n') && this.settings.options.l10n.switcher.enabled === true && this.translationLangs.length > 1) {
        this.addLanguageSelectorWidget();
      }
    },

    /**
     * Adds a language selector widget to the navigation menus
     */
    addLanguageSelectorWidget: function() {
      if (!this.settings.options.l10n) {
        return;
      }

      var selector = this.getLanguageSelectorWidget();

      var $menuBlocks = $('ul.block-mainnavigation');

      $menuBlocks.each(function() {
        $(this).append('<li role="menuitem" style="padding-right: 0.5em">'+selector+'</li>');
      });

      var l10n = this.settings.options.l10n;
      var widget = l10n.switcher.widget;

      var eventType = widget === 'select' ? 'change' : 'click';
      $menuBlocks.find('.ottera-lang-select').on(eventType, Drupal.behaviors.codesbasePublic.activateLanguageChoice.bind(this));
    },

    /**
     * Get the language selector in the style we need
     * @returns {string}
     */
    getLanguageSelectorWidget: function() {
      if (!this.settings.options.l10n) return '';

      var l10n = this.settings.options.l10n;
      var style = l10n.switcher.style;
      var widget = l10n.switcher.widget;

      var selectedLanguage = this.getCurrentLanguage();

      // get available languages that are really actually available for the
      // content being viewed, if possible
      var available_languages = this.settings.available_languages;
      var alternates = $('link[rel="alternate"]');
      if (alternates.length > 0) {
        available_languages = [];
        alternates.each(function(i, alt) {
          available_languages.push($(alt).attr('hreflang'));
        });
      }

      var options = '';
      for (var l = 0; l < available_languages.length; l++) {
        var lang = available_languages[l];
        var selected = selectedLanguage === lang ? 'selected' : '';
        var displayedValue;

        switch(style) {
          case 'code':
          case 'codes':
            displayedValue = lang;
            break;
          case 'flag':
          case 'flags':
            // TODO change this to flag icon
            displayedValue = this.getLocaleNameFromCode(lang) + ' (flag)';
            break;
          case 'word':
          case 'words':
          default:
            displayedValue = this.getLocaleNameFromCode(lang);
            break;
        }

        options += widget === 'select' ? '<option value="'+ lang +'" '+ selected +'>'+ displayedValue +'</option>' : '<button data-value="'+ lang +'" class="button '+ selected +'">'+ displayedValue +'</button>';
      }

      // noinspection UnnecessaryLocalVariableJS
      var selector = widget === 'select' ? '<select class="ottera-lang-select"><option value="">'+ Drupal.t('- Select -') +'</option>'+ options +'</select> <button class="ottera-lang-select--go button">' + Drupal.t('Go') + '</button>' : '<div class="ottera-lang-select">'+ options +'</div>';

      return '<form id="'+this.languageFormId+'">' + selector + '</form>';
    },

    /**
     * Event handler that commits the chosen language to the cookie
     *
     * @param evt
     * @returns {boolean}
     */
    activateLanguageChoice: function(evt) {
      evt.preventDefault();

      // default language comes from channel settings
      var defaultLang = (drupalSettings.codesbasePublic.options && drupalSettings.codesbasePublic.options.language) ? drupalSettings.codesbasePublic.options.language : 'en';

      var $triggered = $(evt.target);
      var $selector;
      if ($triggered.is('form')) {
        $selector = $(evt.target).find('.ottera-lang-select');
      } else {
        $selector = $(evt.target);
      }

      var selectedLang = '';
      if ($selector.is('select')) {
        // ignore clicks for the select box
        if (evt.type === 'click') {
          return false;
        }

        // the select is a select box
        selectedLang = $selector.val();
      } else {
        // the selection was made with a button
        selectedLang = $selector.data('value');
      }

      console.log('Selected language', selectedLang);
      if (!selectedLang) return;

      var cookieDomain = this.getCookieDomain();
      window.OTTera.setCookie(this.languageCookieName, selectedLang, 30, '/', cookieDomain);
      window.OTTera.params.language = selectedLang;

      // clear out cached configuration
      window.OTTera.clearConfiguration();

      // first change for an alternate version of this page in that language - if it exists, go
      var altLink = $('link[rel="alternate"][hreflang="'+selectedLang+'"]');
      if (altLink.length === 1) {
        window.location.href = altLink.attr('href');
        return;
      }

      // replace the language query string, and any path prefix in the URL
      var updatedUrl = this.replaceUrlParamValue('language', selectedLang, true);
      // if we just get back a query string, make this a full URL
      if (updatedUrl.indexOf('?') === 0) {
        updatedUrl = window.location.href + updatedUrl;
      }

      // the path prefix should be removed if we've chosen the default language
      // this could be any of the available languages, so try them all
      var prefixReplace = selectedLang !== defaultLang ? '/'+selectedLang+'/' : '/';
      var availableLangs = this.settings.available_languages;
      if (availableLangs) {
        var oldUrl = updatedUrl;
        for (var l = 0; l < availableLangs.length; l++) {
          updatedUrl = updatedUrl.replace('/'+availableLangs[l]+'/', prefixReplace);
        }
        // if the URL didn't change, add the prefix
        // TODO shouldn't this be unnecessary with Drupal negotiating the language?
        // noinspection EqualityComparisonWithCoercionJS
        if (oldUrl == updatedUrl) {
          // replace first non-protocol slash with a prefix
          var protocol = updatedUrl.slice(0, updatedUrl.indexOf('//') + 2);
          var restOfUrl = updatedUrl.slice(updatedUrl.indexOf('//') + 2);
          restOfUrl = restOfUrl.replace('/', prefixReplace);
          updatedUrl = protocol + restOfUrl;
        }
      }
      window.location.href = updatedUrl;
    },

    /**
     * Get the cookie domain to set a cookie across all website subdomains,
     * for checkout etc.
     * @returns {*}
     */
    getCookieDomain: function() {
      var cookieDomain = window.location.hostname.match(/\w+\.\w+$/);
      if (cookieDomain && cookieDomain.length) {
        cookieDomain = cookieDomain[0];
      } else {
        cookieDomain = window.location.hostname;
      }

      return cookieDomain;
    },

    /**
     * Returns the name to use in the language switcher
     * There must be a better way
     * @param code
     */
    getLocaleNameFromCode: function(code) {
      var name = '';
      switch (code) {
        case 'en':
          name = 'English';
          break;
        case 'es':
          name = 'Español';
          break;
        case 'pt-br':
          name = 'Português';
          break;
        case 'fr':
          name = 'Français';
          break;
        case 'de':
          name = 'Deutsch';
          break;
        case 'ru':
          name = 'русский язык';
          break;
        case 'po':
          name = 'Polski';
          break;
        case 'uk':
          name = 'Украiнська';
          break;
        default:
          name = code;
      }

      return name;
    },

    /**
     * Loads a collection triggered by ?collection=COLLECTION_ID in the URL
     * @returns {boolean}
     */
    loadCollectionByUrl: function() {
      // start with the home section as a backstop
      // this.otteraShowSection('home');

      var collectionId = this.getUrlParameterByName('collection');
      if (!collectionId) {
        return;
      }

      this.makeRequest('search', {
        id: collectionId,
        object_type: 'collection',
        image_format: 'widescreen',
        image_width: 640
      }).then(function(response) {
        if (response && response.objects[0]) {
          this.renderCollection(response.objects[0]);
        }
      }.bind(this));

      return true;
    },

    /**
     * Loads a collection from config triggered by ?collection=SECTION_NAME in the URL
     * @returns {boolean}
     */
    loadSectionByUrl: function() {
      var sectionParam = this.getUrlParameterByName('section');
      if (sectionParam) {
        this.otteraShowSection(sectionParam);
      }
      else {
        this.otteraShowSection('home');
      }

      return true;
    },

    /**
     * Inspect the URL for a redirect param, and go if it's one we've
     * whitelisted
     *
     * @returns {boolean}
     */
    loadRedirectByUrl: function() {
      var redirectParam = this.getUrlParameterByName('redirect');
      if (redirectParam) {
        switch (redirectParam) {
          case 'payment' :
            var authToken = window.OTTera.getAuthToken();

            if (!authToken) {
              window.OTTera.loadFormOnPage({
                id: 'login',
                div_id: 'ottera-modal-inner'
              });

              Drupal.behaviors.codesbasePublic.forwardToPayment = true;

              return false;
            } else {
              this.redirectToLocation(redirectParam);
            }
            break;
          default:
            // If we want to redirect anything that comes through, uncomment this
            // this.redirectToLocation(redirectParam);
            break;
        }
      }

      return false;
    },

    /**
     * Execute the API redirect using the redirect param
     *
     * @param redirectParam
     */
    redirectToLocation(redirectParam) {
      var url = this.makeRequestUrl('redirect', {
        location: redirectParam
      });

      window.location.href = url;
    },

    /**
     *
     * @param rows
     * @param ref
     * @param rowsContext
     *  usually the section from which this content comes
     *
     * @backfilled as showContent
     */
    otteraShowContent: function (rows, ref, rowsContext) {
      ref = ref || this.otteraContentRef;

      ref.html("");
      // $(otteraPlayerRef).html('');
      if (rows != null) {
        var totalRows = rows.length;
        var rowsRendered = 0;

        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];

          var parent_row_id = 'ottera--row--wrap--' + (row.parameters.parent_id ? row.parameters.parent_id : 'idx' + i);

          ref.append('<div class="ottera--row--wrap" id="' + parent_row_id + '"></div>');

          if (row.parameters != null && row.parameters.group_title != null) {
            row.title = row.parameters.group_title;
          }

          // default max is 12, but poster-formatted rows should load more
          // to fill a large screen
          if (row.format === 'poster') {
            row.parameters.max = 18;
          }

          // allow a few more in the sliders since they wrap around
          // and don't auto-load more content
          if (row.style && row.style === 'slider') {
            row.parameters.max = 24;
          }

          if (rowsContext && rowsContext.scale_factors && rowsContext.scale_factors[i]) {
            row.scale_factor = rowsContext.scale_factors[i];
          }

          // special treatment for EPG rows
          if (row.endpoint === 'getvideosegments') {
            this.makeRequest(row.endpoint, row.parameters).then(function processEPGReturn(row, parent_row_id, data) {
              var objects = data.objects;
              if (!objects || objects.length <= 0) return;

              this.renderEpgRow(parent_row_id, data, row.parameters, row.title);
            }.bind(this, row, parent_row_id));

            continue;
          }

          // Make request changes based on the channel
          if (this.settings.channel) {
            var channel = this.settings.channel.toLowerCase();
            if (['oz', 'lv'].indexOf(channel) !== -1) {
              row.extra_display_fields = ['name'];
            }
          }

          this.makeRequest(row.endpoint, row.parameters).then(function (row, parent_row_id, data) {
            // console.log('make request succeeded', data, row);

            var response = data;
            if (response != null) {
              if (response["objects"] != null && response["objects"].length > 0) {
                var content_row_id = parent_row_id.replace('--wrap', '--objects');
                var contentDiv = this.otteraBuildContentDiv(content_row_id, response["objects"], row);

                var title = row["title"];

                // Allow some hard-coded titles to pass through Drupal's translator
                switch (title) {
                  case 'Recent':
                    title = Drupal.t('Recent');
                    break;
                  case 'Favorites':
                    title = Drupal.t('Favorites');
                    break;
                  case 'Playlists':
                    title = Drupal.t('Playlists');
                    break;
                  default:
                    break;
                }

                var rowContent = '<h3 class="ottera--row--header">' + title + '</h3>';
                rowContent += contentDiv;
                ref.find('#' + parent_row_id).html(rowContent);

                var $contentRow = $('#' + content_row_id);

                var loadMoreData = {
                  endpoint: row.endpoint,
                  parameters: row.parameters,
                  start: parseInt(response.num_results, 10)
                };

                if (row.extra_display_fields) {
                  loadMoreData.extra_display_fields = row.extra_display_fields;
                }

                var rowStyle = row.style;
                if (!rowStyle || this.rowStyles.indexOf(rowStyle) === -1) {
                  rowStyle = this.rowStyles[0];
                }

                $contentRow.data(this.datakeyLoadMore, loadMoreData).data(this.dataKeyRowStyle, {
                  style: rowStyle,
                  scale_factor: row.scale_factor ? row.scale_factor : 1
                });

                if (rowStyle) {
                  $contentRow.addClass('ottera-row-style--' + rowStyle);
                }
                if (row.format) {
                  $contentRow.addClass('ottera-row-format--' + row.format);
                }
                if (row.type) {
                  $contentRow.addClass('ottera-row-type--' + row.type);
                }
                if (row.scale_factor) {
                  $contentRow.addClass('ottera-row-sf--' + row.scale_factor.replace('.', '_'));
                }

                ref.trigger('init-carousels', [content_row_id]);

                this.setupAccessChecks('.ottera-access-check', '#' + parent_row_id);
              }

              // Once all the rows have been rendered, check if we need an empty message
              rowsRendered += 1;
              if (rowsRendered >= totalRows) {
                if (ref.text().trim() === '') {
                  // TODO when localized, change default string
                  // window.OTTera.translatePlaceholder('no_content_territory');
                  var noContentMessage = Drupal.t('No content found for your territory.  If you believe this is an error, please try refreshing the page.');

                  if (this.settings.options.no_content && this.settings.options.no_content.url) {
                    var noContentUrl = this.settings.options.no_content.url;
                    var noContentDisplay = this.settings.options.no_content.display ? this.settings.options.no_content.display : this.settings.options.no_content.url;
                    var noContentDelay = this.settings.options.no_content.hasOwnProperty('delay') ? this.settings.options.no_content.delay : 5;

                    noContentMessage += '<br><br>You will be redirected to <a href="'+ noContentUrl +'" target="_blank" rel="noopener noreferrer">' + noContentDisplay + '</a> in ' + noContentDelay + ' seconds';

                    window.setTimeout(function() {
                      window.location.href = noContentUrl;
                    }, parseInt(noContentDelay, 10) * 1000);
                  }

                  ref.html('<p>'+ noContentMessage +'</p>');
                }
              }
            }
          }.bind(this, row, parent_row_id));
        }
      }
    },

    /**
     *
     * @param id
     * @param objects
     * @param rowContext
     * @returns {string}
     *
     * @backfilled as buildContentDiv
     */
    otteraBuildContentDiv: function (id, objects, rowContext) {
      var contentDiv = '<div class="ottera--row--objects" id="' + id + '">';
      for (var j = 0; j < objects.length; j++) {
        contentDiv += this.otteraBuildObject(objects[j], 'string', rowContext);
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
     *
     * @backfilled as buildContentObject
     */
    otteraBuildObject: function (object, returnType, rowContext) {
      returnType = returnType || 'string';
      rowContext = rowContext || null;

      var isPremiumContent = object.hasOwnProperty('premium_content') && object.premium_content === 'true';
      var isPremium = object.hasOwnProperty('is_premium') && object.is_premium === 'true';

      var isPermissioned = object.hasOwnProperty('required_permissions') && object.required_permissions.length;

      var name = object["name"];
      var primaryID = object["primary_id"];
      var url = object["url"] ? object["url"] : '/node/' + primaryID;
      var type = object["type"];
      var video_type = object["video_type"] ? object["video_type"] : '';

      // if url starts with "default", get rid of it
      url = url.replace(/https?:\/\/default/, '');

      var thumbnailUrl = object["thumbnail_url"];
      if (!thumbnailUrl && object.packages && object.packages.length) {
        // try to pull a thumbnail from the packages
        var pkg = object.packages[0];
        if (pkg && pkg.thumbnail_url) {
          thumbnailUrl = pkg.thumbnail_url;
        }
      }

      if (rowContext !== null && rowContext.style === 'slider' && rowContext.parameters.image_format && rowContext.parameters.image_format === 'poster') {
        // if this is a slider, but it's been configured with posters, force widescreen
        // this will guard against widescreen premium thumbnails being overridden
        thumbnailUrl = object["widescreen_thumbnail_url"];
      } else if ((isPremiumContent || isPremium) && object["premium_thumbnail"]) {
        thumbnailUrl = object["premium_thumbnail"];
      }

      if (object["groups"] != null && object["groups"].length > 0) {
        this.otteraGroups[primaryID] = object["groups"];
      }

      // populate viewing overlay for all items (since any could be subject to permissions)
      var overlayMessage = '';
      var overlayClass = 'trans'; // will hide the overlay if we don't really need it
      if (isPremium && !this.otteraIsLoggedInJS()) {
        overlayMessage = this.settings.reg_only.message;
        var overlayClass = '';
      } else if (isPremium && this.otteraIsLoggedInJS() && !this.otteraIsPremiumUser()) {
        overlayMessage = this.settings.premium.message;
        overlayClass = '';
      }

      var overlay = '';
      if (overlayMessage) {
        overlay = '<div class="premium-overlay '+ overlayClass +'"><div class="premium-overlay--inner">' + overlayMessage + '</div></div>';
      }

      // Don't perform access check on rows, for now
      // var accessClass = isPermissioned ? 'ottera-access-check' : '';

      var accessClass = '';
      /*if (type === 'show' && (isPremiumContent || isPremium)) {
        accessClass = 'ottera-access-check';
      }*/

      // TODO - support scale factors somehow
      // var scaleFactor = rowContext.scale_factor ? rowContext.scale_factor : 1;
      // var styles = "transform: scale("+ scaleFactor +")";
      var styles = "";

      // there might be extra data to render here
      var extraFields = '';
      if (rowContext && rowContext.extra_display_fields && rowContext.extra_display_fields.length) {
        extraFields += '<div class="extra-fields">'
        if (rowContext.extra_display_fields.indexOf('name') !== -1) {
          extraFields += '<h4 class="ottera--row--item--title">' + name + '</h4>'
        }

        var displayedDuration = '';
        if (rowContext.extra_display_fields.indexOf('duration') !== -1) {
          var dur = this.getDuration(object);
          if (dur !== '0:00') {
            displayedDuration = '(' + dur + ')';
          }
        }

        // assume short and long descriptions won't be asked for at the same time
        if (rowContext.extra_display_fields.indexOf('short_description') !== -1) {
          extraFields += '<div class="ottera--row--item--short-description">' + displayedDuration + ' ' + object.short_description + '</div>'
        }
        if (rowContext.extra_display_fields.indexOf('long_description') !== -1) {
          extraFields += '<div class="ottera--row--item--long-description">' + displayedDuration + ' ' + object.long_description + '</div>'
        }
        extraFields += '</div>';
      }

      var objStr = '<a href="' + url + '" class="ottera--row--item ottera-link-select ' + accessClass + '" data-ottera-id="' + primaryID + '" data-ottera-type="' + type + '" data-ottera-video-type="' + video_type + '" title="' + name + '" data-ottera-url="' + url + '" style="' + styles +'"><img src="' + thumbnailUrl + '" alt="' + name + '" loading="lazy" />' + extraFields + overlay + '</a>';

      switch (returnType) {
        case 'string':
          return objStr;
        case 'jq':
          return $(objStr);
      }
    },

    /**
     * Callback to handle selection of an object when the player should be
     * loaded inline
     * @deprecated
     *
     * @see otteraObjectClick
     *
     * @param evt
     */
    otteraSelectObject: function (evt) {
      var $link = $(evt.target).closest('.ottera-link-select'),
        primaryID = $link.data('ottera-id'),
        type = $link.data('ottera-type');

      this.otteraPlayerRef.html('');

      if (primaryID == null || type == null) {
        return;
      }
      if (type === "video") {
        var playerEmbed = this.getPlayerEmbedHtml();

        this.otteraPlayerRef.html(playerEmbed);
        var contentUrl = encodeURIComponent(window.location.href);
        var deviceType = "desktop";
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          deviceType = "handset";
        }

        var params = {
          "id": primaryID,
          "div_id": "video_player",
          "content_page_url": contentUrl,
          "device_type": deviceType
        };

        var url = this.makeRequestUrl('embeddedVideoPlayer', params);

        var script = document.createElement('script');
        // Comment this out when you are done testing
        script.onload = function () {
          console.log('Player script loaded');
        };
        var authToken = '';
        if (this.otteraIsLoggedInJS()) {
          var token = OTTera.getCookie('ottAuthToken');
          authToken = "&auth_token=" + token;
        }
        script.src = url;
        document.head.appendChild(script);
      }
      else if (type === "show") {
        if (window.OTTera.configuration !== null) {
          var requests = window.OTTera.configuration.requests;
          if (requests["assets_show"] != null) {
            var groupsDict = $.extend([], this.otteraGroups[primaryID]);

            var rows = [];
            for (var i = 0; i < groupsDict.length; i++) {
              var group = $.extend({}, groupsDict[i]);
              var showRequest = $.extend({}, requests["assets_show"]);
              var parameters = $.extend({}, showRequest["parameters"]);
              parameters["group_by"] = group["group_by"];
              parameters["group_filter"] = group["group_filter"];
              parameters["group_title"] = group["group_title"];
              parameters["parent_id"] = primaryID;
              showRequest["parameters"] = parameters;
              rows.push(showRequest);
            }
            this.otteraShowContent(rows, this.otteraContentRef);
          }
        }
      }
    },

    /**
     * Event handler for EPG objects clicked in OTTera grids.     *
     * @param evt
     */
    otteraEPGObjectClick: function (evt) {
      //evt.preventDefault();
      //(i) button has been clicked
      epgClickHandled=true;

      var objectId = $(evt.target).closest('.ottera--epg--info').attr('data-object');
      for (var i = 0; i < epgArr.length; i++) {
        if (typeof result === 'undefined') {
          var result = epgArr[i].filter(obj => {
            return obj.id === objectId
          })
        }
        if (result.length == 0) {
          var result = epgArr[i].filter(obj => {
            return obj.id === objectId
          })
        }
      }

      if (result.length) {
        if ($(evt.target).closest('.ottera--row--wrap').length) {
          let title = result[0].name;
          let description = '';
          if (result[0].long_description) {
            description = result[0].long_description;
          } else if (result[0].short_description) {
            description = result[0].short_description;
          }
          $(evt.target).closest('.ottera--row--wrap').css('position', 'relative');
          $(evt.target).closest('.ottera--row--wrap').prepend('<div class="epg--modal"></div>');

          var innerContent = '<div class="epg--modal--box"><button class="close-button epg-close-button" type="button"><span aria-hidden="true">×</span></button><h4>' + title + '</h4><p>' + description + '</p></div>';
          $(evt.target).closest('.ottera--row--wrap').children('.epg--modal').html(innerContent);

        }
      }

      $('#ottera-content').on('click', '.epg--modal', function (evt) {
        evt.preventDefault();
        if ($(evt.target).closest('.epg--modal').length) {
          $(evt.target).closest('.ottera--row--wrap').css('position', '');
          $(evt.target).closest('.epg--modal').remove();
        }
      });

    },
    /**
     * Event handler for objects clicked in OTTera grids.
     * If it's a regular link, it just passes through, but special links
     * can have other behaviors.  So far, only section:// links are handled.
     *
     * @param evt
     */
    otteraObjectClick: function(evt) {

      //if otteraEPGObjectClick has laredy handled this event then no need toi handle it
      if(epgClickHandled) {
        evt.preventDefault();
        epgClickHandled=false;
        return;
      }
      var $link = $(evt.target).closest('.ottera-link-select'),
        primaryID = $link.data('ottera-id'),
        type = $link.data('ottera-type'),
        video_type = $link.data('ottera-video-type');

      //TODO want only to handle clicks, not drags or swipes

      if ($link.attr('href').indexOf('section://') !== -1) {
        evt.preventDefault();

        var sectionName = $link.attr('href').replace('section://', '');
        this.otteraShowSection(sectionName);

        return;
      } else if (!primaryID && $link.attr('href').indexOf('video://') !== -1) {
        primaryID = $link.attr('href').match(/video:\/\/(\d+)/)[1];
      }

      // might enhance this function to look at object types as well
      switch(type) {
        case 'news':
        case 'character':
          this.processNavLink(primaryID);
          evt.preventDefault();
          break;
        case 'collection':
          this.makeRequest('search', {
            id: primaryID,
            type: 'collection',
            image_format: 'widescreen',
            image_width: 640
          }).then(function(response) {
            if (response && response.objects[0]) {
              this.renderCollection(response.objects[0]);
            }
          }.bind(this));
          evt.preventDefault();
          break;
        case 'video':
          this.getItemDataAndCache(primaryID).then(function() {
            var videoObj = this.getItemFromCache(primaryID);

            if (video_type === 'linear') {
              if (this.otteraLinearIsActive) {
                // linear is active, should not be
                this.clearOtteraLinear();

                var linearLoaded = this.initOtteraLinear({
                  videoId: videoObj.id,
                  channelId: videoObj.linear_channel_id,
                  url: videoObj.url,
                  mute: false
                });

                if (linearLoaded) {
                  evt.preventDefault();
                } else {
                  window.location.href = videoObj.url;
                }
              }
              else if (videoObj.url) {
                window.location.href = videoObj.url;
              }
            } else if (videoObj.url) {
              window.location.href = videoObj.url;
            }
          }.bind(this));
          evt.preventDefault();
          break;
        default:
          break;
      }

      // anything else should just pass through
    },

    /**
     * @backfilled
     * @returns {""|null|number}
     */
    otteraIsLoggedInJS: function () {
      var authToken = OTTera.getCookie('ottAuthToken');
      return authToken && authToken.hasOwnProperty('length') && authToken.length > 0;
    },

    otteraIsPremiumUser: function () {
      // otherwise check permissions
      return window.OTTera.hasPermission('PR');
    },

    /**
     * Builds the homepage display
     * @param evt
     *
     * @backfilled as showHomeJS
     */
    otteraShowHomeJS: function (evt) {
      // if this isn't used as a click handler, ignore
      if (evt) {
        evt.preventDefault();
        var $link = $(evt.currentTarget);

        var $mainMenus = $('ul.block-mainnavigation');
        $mainMenus.find('a').removeClass('is-active');
        $link.addClass('is-active');
      }

      this.otteraShowSection('home');
    },

    /**
     * Helper function displays the section, which is often "home", but can be
     * anything.
     *
     * @param sectionName
     */
    otteraShowSection: function(sectionName) {
      this.otteraPlayerRef.html('');

      var $logoImg = $('#block-sitebranding').find('img');

      if (window.OTTera.configuration.sections !== null && window.OTTera.configuration.sections.length > 0) {
        // find the right section by name
        var selectedSections = window.OTTera.configuration.sections.filter(function(s) {
          if (s && s.section) {
            return s.section === sectionName;
          }
        });
        var selectedSection = null;

        var selectedSectionIsHome = sectionName === 'home';

        // if there's none matching, just get the first one (usually home)
        if (selectedSections.length > 0) {
          selectedSection = selectedSections[0];
          selectedSectionIsHome = true;
        } else {
          selectedSection = window.OTTera.configuration.sections[0];
        }

        // if we're already here, no need to update
        if (this.currentSection === selectedSection.section) return;

        this.currentSection = selectedSection.section;

        this.otteraShowContent(selectedSection.items, this.otteraContentRef, selectedSection);

        // maybe switch the logo if appropriate
        if (selectedSection.hasOwnProperty('logo')) {
          var sectionLogo = selectedSection.logo;

          var fadeSpeed = 'fast';
          var defaultLogoPath = '/' + this.settings.theme.path + '/logo.png';

          // default logo is called title
          if (sectionLogo === 'title') {
            $logoImg.fadeOut(fadeSpeed, function() {
              $logoImg
                .attr('src', defaultLogoPath)
                .fadeIn(fadeSpeed);
            });
          } else {
            var customLogoPath = '/' + this.settings.theme.path + '/img/logo_alt/' + sectionLogo + '.png';
            var sectionLogoImage = new Image();
            sectionLogoImage.onload = function() {
              $logoImg.fadeOut(fadeSpeed, function() {
                $logoImg
                  .attr('src', customLogoPath)
                  .fadeIn(fadeSpeed);
              });
            }
            sectionLogoImage.onerror = function() {
              console.error('Logo does not exist - replacing with default if needed', customLogoPath);
              $logoImg.attr('src', defaultLogoPath);
            }.bind(this);
            sectionLogoImage.src = customLogoPath;
          }
        } else {
          // switch to default logo
          var defaultLogoPath = '/' + this.settings.theme.path + '/logo.png';
          $logoImg.fadeOut(fadeSpeed, function() {
            $logoImg
              .attr('src', defaultLogoPath)
              .fadeIn(fadeSpeed);
          });
        }

        // set a fresh body class based on this section
        var $body = $('body');
        var bodyClasses = $body.attr('class');
        bodyClasses = bodyClasses.replace(/ section--.+/gi, '');
        bodyClasses += ' section--' + sectionName;
        $body.attr('class', bodyClasses);

        this.updateUrlFromSection(selectedSection);

        // add the linear player if we're loading a new section, and it's called for
        var shouldLinearLoad = this.shouldLinearLoad();
        if (shouldLinearLoad) {
          // check if we have an allowed section
          if(selectedSection.allowed_linear_video_ids) {
            this.initOtteraLinear({
              videoId: selectedSection.allowed_linear_video_ids[0],
              channelId: 'lookup',
            });
          }
          else {
            this.initOtteraLinear();
          }
        } else {
          if (this.otteraLinearIsActive) {
            // linear is active, should not be
            this.clearOtteraLinear();
          }
        }
      }
      else {
        this.otteraShowContent(null);
      }
    },

    /**
     * Updates the url based on the selected section using pushState
     *
     * When we load new sections, we don't want to refresh the page,
     * but we want the URL to update.
     *
     * @param sectionObj
     */
    updateUrlFromSection: function(sectionObj) {
      if (!window.history.pushState) return;

      if (!this.allowJsPageLoads) return;

      var state = { section: sectionObj.section },
        title = window.OTTera.translatePlaceholder(sectionObj.title);

      var url = this.replaceUrlParamValue('section', sectionObj.section, true);

      // Home is the default, remove if that's the one
      url = url.replace(/&?section=home/, '');

      if (url.indexOf('section') !== -1) {
        // update the URL based on the section being loaded
        window.history.pushState(state, title, url);
      }
    },

    /**
     * Updates the url based on the search term
     *
     * @param string searchKey
     */
    updateUrlFromSearch: function(searchKey) {
      if (!window.history.pushState) return;

      var state = { searchKey: searchKey },
        title = Drupal.t('Search: ') + searchKey;

      var url = this.replaceUrlParamValue('key', searchKey, true);

      if (url.indexOf('search') !== -1) {
        // update the URL based on the section being loaded
        window.history.pushState(state, title, url);
      }
    },

    /**
     * Processes the data in a news object, using package contents
     * (These are navlinks)
     *
     * @see handleNavLink
     *
     * @param id
     */
    processNavLink: function (id) {
      this.getItemDataAndCache(id).then(function (data) {
        if (data.link) {
          var sectionMatch = data.link.match(/section:\/\/(\w+)/);
          if (sectionMatch) {
            this.otteraShowSection(sectionMatch[1]);
            return;
          }

          var linkMatch;
          linkMatch = data.link.match(/^(webs?:\/\/|https?:\/\/)(.+)/);
          if (linkMatch && linkMatch[1] && linkMatch[2]) {
            var protocol = linkMatch[1];
            var directive = decodeURIComponent(linkMatch[2]);

            if (protocol === 'webs://') {
              protocol = 'https://';
            } else if (protocol === 'web://') {
              protocol = 'http://';
            }
            window.location.href = protocol + directive;
            return true;
          }

          linkMatch = data.link.match(/^nav:\/\/(.+)/);
          if (linkMatch && linkMatch[1]) {
            var navLinkContent = linkMatch[1];

            this.handleNavLink(navLinkContent);
            return false;
          }
        } else if (data.packages && data.packages[0]) {
          var pkg = data.packages[0];

          switch (pkg.type) {
            case 'show':
              // if it's a show, go
              if (pkg.url) {
                window.location.href = pkg.url;
              }
              break;
            case 'video':
              // linear videos should update the player
              this.checkAccessAndPrompt(pkg.id, function() {
                if (pkg.video_type && pkg.video_type === 'linear') {
                  this.initOtteraLinear({videoId: pkg.id, channelId: pkg.linear_channel_id});
                } else if (pkg.url) {
                  // everything else can go to the page
                  window.location.href = pkg.url;
                }

                return true;
              }.bind(this));
              break;
            case 'collection':
              this.renderCollection(pkg);

              break;
          }
        } else if (data.video_type) {
          this.checkAccessAndPrompt(data.id, function() {
            if (data.video_type === 'linear') {
              this.initOtteraLinear({
                videoId: data.id,
                channelId: data.linear_channel_id
              });
            } else if (data.url) {
              // everything else can go to the page
              window.location.href = data.url;
            }
          }.bind(this));
        }
      }.bind(this));
    },

    /**
     * Act on links whose content is nav://something
     *
     * @param content - what appears after nav://
     *
     * @see processNavLink
     */
    handleNavLink: function(content) {
      switch (content) {
        case 'loginregister':
        case 'login':
          this.loadLoginForm();
          break;
        case 'register':
          this.loadRegisterForm();
          break;
        case 'premium':
          window.location.href = '/upgrade';
          break;
      }
    },

    /**
     * Render a collection inline (no page load)
     *
     * @param collection
     */
    renderCollection: function(collection) {
      var ref = this.otteraContentRef;
      ref.html("");
      window.scrollTo(0, 0);
      this.currentSection = null;

      // no linear player here
      this.clearOtteraLinear();

      var collectionTop = "<div class='ottera-collection-back'><a href='/' onclick='Drupal.behaviors.codesbasePublic.otteraShowSection(); return false;'>˟️</a></div><h2 class='ottera-collection-title'>" + collection.name + "</h2><div class='ottera-collection--top row'>";

      if (collection.thumbnail_url) {
        collectionTop += "<div class='ottera-collection-thumbnail columns small-12 medium-4'><img src='" + collection.thumbnail_url + "' loading='lazy'></div>";
      }

      collectionTop += "<div class='columns small-12 medium-8'>";

      if (collection.child_count) {
        collectionTop += "<div class='ottera-collection-items' style='padding-bottom: 0.5em; font-size: 90%'>" + collection.child_count + Drupal.t(" items") + "</div>";
      }

      if (collection.long_description || collection.short_description) {
        collectionTop += "<div class='ottera-collection-description' style='white-space: pre-line'>";
        if (collection.long_description) {
          collectionTop += this.truncateString(collection.long_description, 250, true);
        } else {
          collectionTop += collection.short_description;
        }
        collectionTop += "</div>";
      }

      collectionTop += "</div>";
      collectionTop += '</div>';

      ref.append(collectionTop);

      var requests = [];
      var params = {};

      // check for groups
      if (collection.hasOwnProperty('groups') && collection.groups.length > 0) {
        for (var g = 0; g < collection.groups.length; g++) {
          var groupContent = collection.groups[g];

          params = {
            parent_id: collection.id,
            parent_type: 'collection',
            image_format: 'widescreen',
            image_width: 640,
            use_device_width_widescreen: 0
          };

          if (groupContent.group_filter !== 'ignore') {
            params.group_by = groupContent.group_by;
            params.group_filter = groupContent.group_filter;
          }

          requests.push(this.makeRequest('getreferencedobjects', params));
        }
      } else if (collection.hasOwnProperty('child_count')) {
        // if there are no groups, check for children
        params = {
          parent_id: collection.id,
          parent_type: 'collection',
          image_format: 'widescreen',
          image_width: 640,
          use_device_width_widescreen: 0
        };

        requests.push(this.makeRequest('getreferencedobjects', params));
      }

      var resolvedRequests;
      if (requests.length === 1) {
        resolvedRequests = $.when(requests[0]);

        resolvedRequests.then(function (response) {
          this.renderCollectionRow(collection, response, 0);
        }.bind(this));
      } else {
        $.when.all(requests).then(function(responses) {
          for (var r = 0; r < responses.length; r++) {
            var response = responses[r][0];

            this.renderCollectionRow(collection, response, r);
          }
        }.bind(this));
      }
    },

    truncateString: function(str, n, useWordBoundary){
      var toLong = str.length > n
        , s_ = toLong ? str.substr(0, n-1) : str;

      s_ = useWordBoundary && toLong ? s_.substr(0, s_.lastIndexOf(' ')) : s_;
      return  toLong ? s_ + '&hellip;' : s_;
    },

    /**
     * Render a single collection row
     *
     * @param pkg
     * @param response
     * @param index
     */
    renderCollectionRow: function(pkg, response, index) {
      var ref = this.otteraContentRef;

      var groupContent = pkg.groups ? pkg.groups[index] : null;

      var row = {
        endpoint: 'getreferencedobjects',
        format: 'widescreen',
        style: 'table',
        scale_factor: 1,
        parameters: {
          parent_id: pkg.id,
          parent_type: 'collection',
          getrelatedobjects: 1
        },
        objects: response.objects
      };

      if (groupContent) {
        row.parameters.group_title = groupContent.group_title;
        row.id = groupContent.group_filter;

        if (groupContent.group_filter !== 'ignore') {
          row.parameters.group_by = groupContent.group_by;
          row.parameters.group_filter = groupContent.group_filter;
        }

        // For groups within collections, display a couple extra fields
        row.extra_display_fields = ['name', 'duration', 'short_description'];
      }

      var parent_row_id = 'ottera--row--wrap--' + row.id;
      ref.append('<div class="ottera--row--wrap" id="' + parent_row_id + '"></div>');
      var content_row_id = parent_row_id.replace('--wrap', '--objects');

      var contentDiv = this.otteraBuildContentDiv(content_row_id, row.objects, row);

      var rowContent = '';
      if (row.parameters.group_title) {
        rowContent += '<h3 class="ottera--row--header">' + row.parameters.group_title + '</h3>';
      }
      rowContent += contentDiv;
      ref.find('#' + parent_row_id).html(rowContent);

      var $contentRow = $('#' + content_row_id);

      var rowStyle = row.style;
      if (!rowStyle || this.rowStyles.indexOf(rowStyle) === -1) {
        rowStyle = this.rowStyles[0];
      }

      $contentRow.data(this.datakeyLoadMore, {
        endpoint: row.endpoint,
        parameters: row.parameters,
        start: parseInt(response.num_results, 10),
        extra_display_fields: row.extra_display_fields ? row.extra_display_fields : []
      }).data(this.dataKeyRowStyle, {
        style: row.rowStyle,
        scale_factor: row.scale_factor ? row.scale_factor : 1
      });

      $contentRow.addClass('ottera-row-style--' + row.style);
      $contentRow.addClass('ottera-row-format--' + row.format);

      ref.trigger('init-carousels', [content_row_id]);

      this.setupAccessChecks('.ottera-access-check', '#' + parent_row_id);
    },

    /**
     * Pull a collection's items into a collection page
     * from the API (auto-follow only for the moment)
     */
    renderCollectionPage: function() {
      var container = $('.collection--auto-follow');
      if (container.data('collection-id')) {
        var params = {
          parent_id: container.data('collection-id'),
          parent_type: 'collection',
          image_format: 'widescreen',
          image_width: 400,
          use_device_width_widescreen: 0,
          max: 90
        };

        this.makeRequest('getreferencedobjects', params).then(function(data) {
          var markup = '<div class="row small-up-2 medium-up-4 large-up-6">';
          if (!data.objects.length) {
            markup += '<div class="column">No items available</div>';
            container.html(markup);
            return;
          }

          data.objects.every(function(object) {
            markup += '<div class="column">';
            markup += '<a href="'+object.url+'" title="'+object.name+'" data-ottera-url="'+object.url+'" data-ottera-id="'+object.id+'" class="collection--item ottera-access-check">';
            markup += '<noscript class="loading-lazy">';
            markup += '<img src="'+object.thumbnail_url+'" alt="'+object.name+'" loading="lazy">';
            markup += '</noscript>';
            markup += '<h4 class="collection--item--title">'+object.name+'</h4>';
            markup += '</a></div>';

            return true;
          });

          container.html(markup);

          if (window.loadingAttributePolyfill) {
            var lazyImages = document.querySelectorAll('article noscript.loading-lazy');
            this._forEach(lazyImages, function(i, el) {
              window.loadingAttributePolyfill.prepareElement(el);
            });
          }
        }.bind(this));
      }
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

    /**
     * Builds an API URL to be saved and called later
     * @param action
     * @param params
     * @returns {string}
     *
     * @back
     */
    makeRequestUrl: function (action, params) {
      // for v13 or greater, signature or bypass required
      var signed = this.otteraVersionAtLeast(13);

      params = $.extend({}, window.OTTera.params, params);

      // make sure there's always an auth_token in the params if available
      if (!params.auth_token && this.otteraIsLoggedInJS()) {
        params.auth_token = OTTera.getCookie('ottAuthToken');
      }

      // add permissions params to requests that need them
      var permissionsActions = ['getmediaunlock', 'embeddedVideoPlayer'];
      if (permissionsActions.indexOf(action) !== -1) {
        if (!params.permissions && this.getUserPermissions().length) {

          var userPermissions = this.getUserPermissions();
          var adIndex = userPermissions.indexOf('AD');
          if (adIndex !== -1) {
            userPermissions = userPermissions.splice(adIndex - 1, 1);
          }

          params.permissions = userPermissions.join(',');
        }
      }

      // Add a timestamp, in seconds instead of ms
      if (!params.timestamp) {
        params.timestamp = Math.floor(Date.now() / 1000);
      }

      var apiHost = window.OTTera.options.api;

      return apiHost + '/' + action + '?' + $.param(params);
    },

    /**
     * set some default params for every OTTera request
     *
     * @param options
     *
     * @backfilled as setDefaultParams
     */
    setDefaultOTTeraParams: function (options) {
      window.OTTera.params.version = options.version;
      window.OTTera.params.platform = 'web';
      window.OTTera.params.language = this.getCurrentLanguage();

      var country_code = this.getOverriddenCountry();
      if (country_code) {
        window.OTTera.params.force_country_code = country_code;
        window.OTTera.params.debug = 1; // not sure if we need this
      }
    },

    /**
     * When we're overriding the country, get the value
     *
     * @returns {string|null}
     */
    getOverriddenCountry: function() {
      var country_code = window.OTTera.getCookie('force_country_code');

      return country_code ? country_code : null;
    },

    getRequestHeaders: function() {
      if (this.settings.options.version < 13) return {};

      var headers = {
        'ottera-referrer': this.getReferrerHeader()
      };

      if (this.settings.options.cs_auth_token) {
        headers['ottera-cs-auth'] = this.settings.options.cs_auth_token;
      }

      return headers;
    },

    /**
     * Makes an API request, merging the default params
     *
     * @param action
     * @param params
     * @returns Promise
     */
    makeRequest: function(action, params) {
      // for v13 or greater, signature or bypass required
      var signed = this.otteraVersionAtLeast(13);

      // for compatibility with jsLib
      var w = window;

      // merge params
      var params = $.extend({}, window.OTTera.params, params);

      // make sure there's always an auth_token in the params if available
      if (!params.auth_token) {
        var auth_token = w.OTTera.getAuthToken();
        if (auth_token) params.auth_token = auth_token;
      }

      // TODO update this to only send the permissions that intersect with the product's required_permissions
      // @see also this.makeRequestUrl
      // add permissions params to requests that need them
      var permissionsActions = ['getmediaunlock', 'embeddedVideoPlayer'];
      if (permissionsActions.indexOf(action) !== -1) {
        if (!params.permissions && this.getUserPermissions().length) {
          params.permissions = this.getUserPermissions().join(',');
        }
      }

      // Add a timestamp, in seconds instead of ms
      if (!params.timestamp) {
        params.timestamp = Math.floor(Date.now() / 1000);
      }

      // Add the timezone if not already specified
      if (!params.timezone && OTTera.getTimezone) {
        params.timezone = OTTera.getTimezone();
      }

      var paramString = this.stringFromParameters(params, true);

      var headers = this.getRequestHeaders();

      var apiHost = w.OTTera.options.api;
      var apiHostProd = w.OTTera.options.api_prod ? w.OTTera.options.api_prod : w.OTTera.options.api;

      switch (action) {
        // check for checkout action to build redirect
        case 'checkout':
        case 'redirect':
          return w.location = apiHost + '/' + action + '?' + paramString;
          break;
        case 'formhandler':
          if (undefined === params.token) {
            return $.get({
              url: apiHost + '/' + action + '?' + paramString,
              headers: this.getRequestHeaders()
            });
          }
          break;
        case 'getconfiguration':
        case 'getreferencedobjects':
        case 'getobjects':
          return $.get({
            url: apiHost + '/' + action + '?' + paramString,
            headers: this.getRequestHeaders()
          });
          break;
        case 'getvideosegments':
          return $.get({
            url: apiHostProd + '/' + action + '?' + paramString,
            headers: this.getRequestHeaders()
          });
          break;
        default:
          return $.post({
            url: apiHost + '/' + action,
            data: params,
            headers: this.getRequestHeaders()
          });
      }
    },

    /**
     * Set up places on the page where content access checks should be made on
     * click/tap
     *
     * Video players will have their own, so this is for other objects we want
     * to check preemptively
     */
    setupAccessChecks: function(accessCheckClass, context) {
      context = context || '#main';

      $(context).find(accessCheckClass).click(function(evt) {
        evt.preventDefault();

        var $t = $(evt.currentTarget);

        var itemId = $t.data('ottera-id');
        var url = $t.data('ottera-url');

        this.checkAccessAndPrompt(itemId, function() {
          window.location.href = url;
          return true;
        });
      }.bind(this));
    },

    /**
     * Sets up embedded video players
     * @param playerTriggerClass
     *
     * @backfilled
     */
    setupEmbeddedPlayers: function (playerTriggerClass) {
      var $playerArea = $(playerTriggerClass);

      var itemId = $playerArea.data('ottera-id');

      if (this.adsAreBlocked() && !this.otteraIsPremiumUser()) {
        $playerArea.append('<div class="ads-unblock-message"><p>' + this.settings.ads.unblockMessage + '</p><p><a href="' + window.location.href + '">Reload this page</a>.</p></div>');
        $playerArea.find('.player-container').hide();
        $playerArea.find('.play-icon').hide();
        return;
      }

      // if this channel allows autoplay, or supports TVOD at v14 or greater
      // check access right away and autoplay if possible
      if (this.allowAutoPlay() || this.otteraVersionAtLeast(14)) {
        this.checkAccessAndPrompt(itemId, function() {
          $playerArea.find('.premium-message').remove();

          if (this.allowAutoPlay(itemId)) {
            this.loadEmbeddedPlayer({
              id: itemId,
              auto_play: this.settings.options.auto_play,
            });
            $playerArea.find('.player-container').fadeIn('fast');
            $playerArea.find('.play-icon').hide();
          }
        }.bind(this), function() {
          $playerArea.find('.premium-message').addClass('not-premium');
        });
      } else if (!this.otteraVersionAtLeast(14)) {
        this.checkAccessAndPrompt(itemId, function() {
          // hide lock button for < v13 when the user has access via registration or subscription
          $playerArea.find('.premium-message').remove();
        }.bind(this), function() {
          $playerArea.find('.premium-message').addClass('not-premium');
        });
      }

      $playerArea.click(function(evt) {
        evt.preventDefault();

        if ($playerArea.hasClass('trailer')) {
          return;
        }

        this.checkAccessAndPrompt(itemId, function() {
          $playerArea.find('.premium-message').remove();

          // load with autoplay and muting signals disabled
          this.loadEmbeddedPlayer({
            id: itemId,
            mute: false,
            auto_play: {
              desktop: true,
              mobile: true
            }
          });
          $playerArea.find('.player-container').fadeIn('fast');
          $playerArea.find('.play-icon').hide();
        }.bind(this));
      }.bind(this))
    },

    /**
     * Are we allowed to autoplay videos for the active channel?
     *
     * @returns {boolean}
     */
    allowAutoPlay: function(itemId) {
      // on v14+ check for required item permissions
      // if we're subject to permissions, do not auto play
      if (itemId && this.otteraVersionAtLeast(14)) {
        var itemData = this.getItemFromCache(itemId);
        if (itemData) {
          if (itemData.hasOwnProperty('required_permissions') && itemData.required_permissions.length > 0) {
            return false;
          }
        }
      }

      if (window.OTTera.params.device_type === 'desktop' && this.settings.options.auto_play.desktop === true) return true;

      if (this.settings.options.auto_play.mobile === true && window.OTTera.params.device_type !== 'desktop') return true;

      return false;
    },

    /**
     *
     * @param extra_params
     *
     * @backfilled
     */
    loadEmbeddedPlayer: function(extra_params, full_reload) {
      extra_params = extra_params || {};
      full_reload = !!full_reload;

        var defaultParams = {
          "div_id": "video_player",
          "content_page_url": encodeURIComponent(window.location.href),
          "image_width": "1280",
          "max_bitrate": 10000 // enables possibility of 4K
        };

        if (this.canPlay('h265')) {
          defaultParams.h265 = 1;
          defaultParams.max_res = 2160;
        }

        var params = Object.assign({}, defaultParams, extra_params);

        if (full_reload) {
          $('#'+params.div_id).html('');
        }

        if (this.otteraPlayerLoadedIds.indexOf(params.div_id) === -1) {
          this.otteraPlayerLoadedIds.push(params.div_id);
        } else {
          // player appears to have been loaded ready, but check for otteraPlayer global to be sure
          if (!full_reload && (window.otteraPlayer || window.OTTera.player)) return;
        }

        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          params.device_type = "handset";
          //TODO If we get tablet in here add another size alternative
          params.image_width = '768';
        }

        var url = this.makeRequestUrl('embeddedVideoPlayer', params);

        if (parseInt(this.settings.options.version, 10) >= 13) {
          $.ajax({
            url: url,
            method: 'get',
            headers: this.getRequestHeaders(),
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
    },

    /**
     * Test whether the current device can play a media type
     *
     * @param mediaType<String>: 4k, etc
     * @returns {boolean}
     */
    canPlay: function(mediaType) {
      var canPlayIt = false;
      var videoObj = document.createElement('video');

      switch (mediaType) {
        case 'h265':
          var videoCan = videoObj.canPlayType('video/mp4; codecs="hev1.1.c.L150.80, mp4a.40.2"');
          var videoCanB = videoObj.canPlayType('video/mp4; codecs="hvc1"');
          if (videoCan.indexOf("probably") !== -1 || videoCanB.indexOf("probably") !== -1) {
            canPlayIt = true;
          }
          break;
        case 'webm':
          var videoCanC = videoObj.canPlayType('video/webm; codecs="vp8, vorbis"');
          if (videoCanC.indexOf("probably") !== -1) {
            canPlayIt = true;
          }
          break;
      }

      return canPlayIt;
    },

    /**
     * Behaviors for show nodes
     */
    initShowPage: function () {
      var $showEpisodes = $('.node--show .show--season-episodes');

      if ($showEpisodes.length === 0) {
        return;
      }

      $showEpisodes.each(function(i, el) {
        var $row = $(el);
        $row.flickity(this.flickityOptions);
        this.addFlickityEvents($row);
      }.bind(this));
    },

    /**
     * Create the search header icon and form
     */
    initOTTeraSearchHeader: function() {
      var $metaHeaderInner = $('.meta-header-inner');
      var $metaHeaderWrapper = $('.meta-header-wrapper');
      var $existingSearchIcon = $('.header-search-icon', $metaHeaderInner);
      if (!$existingSearchIcon.length) {
        $metaHeaderInner.append('<a href="/search" class="header-search-icon"><i class="fas fa-search"></i></a>');

        $metaHeaderWrapper.append('<div class="meta-header--search"><form action="/search"><div class="input-group align-center">    <input type="search" placeholder="' + Drupal.t('Search…') + '" class="input-group-field" name="key" value="">\n' +
          '    <button class="input-group-button button">' + Drupal.t('Go') + '</button>\n' +
          '</div></form></div>');

        $metaHeaderInner.on('click', '.header-search-icon', function toggleHeaderSearch(evt) {
          evt.preventDefault();

          var $searchBox = $metaHeaderWrapper.find('.meta-header--search');
          $searchBox.toggleClass('open');

          if ($searchBox.hasClass('open')) {
            $searchBox.find('input[type=search]')
              .focus();
          }
        });

        $('body').trigger('OTTera_search_ready');
      }
    },

    /**
     * Behaviors for the /search endpoint
     * @backfilled as initSearch
     */
    initOtteraSearch: function () {
      var initialSearchKey = this.getUrlParameterByName('key');
      if (!initialSearchKey) initialSearchKey = ''; // we want this to always be an empty string, not null

      this.otteraSearchRef.html('<form class="ottera-js-search--form">\n' +
        '<div class="input-group">' +
        '    <input type="search" placeholder="' + Drupal.t('Search…') + '" class="ottera-js-search--field input-group-field" value="' + initialSearchKey + '">\n' +
        '    <button class="ottera-js-search--button input-group-button button">' + Drupal.t('Go') + '</button>\n' +
        '</div>\n' +
        '</form>\n' +
        '\n' +
        '<div id="ottera-js-search--results">' +
        '</div>');

      this.otteraSearchRef.on('init-carousels', this.initCarousels.bind(this));

      this.otteraSearchRef.on('submit', '.ottera-js-search--form', function submitOtteraSearch(evt) {
        evt.preventDefault();

        var $form = $(evt.target).closest('.ottera-js-search--form'),
          searchKey = $form.find('input').val().trim(),
          $resultsArea = $('#ottera-js-search--results');

        if (!searchKey) {
          return false;
        }
        else {
          $resultsArea.html('');
        }

        if (searchKey !== this.otteraSearchKey) {
          this.otteraSearchKey = searchKey;
          this.updateUrlFromSearch(searchKey);
        }

        /*
        Sample params:
       {"b_image_height":"360","banners":"1","connection":"wifi","device_height":"720","device_id":"web","device_manufacturer":"Mozilla","device_model":"Mozilla tv","device_type":"tv","device_width":"1280","image_width":"284","key":"drink","language":"en","object_type":"show","partner":"html5","platform":"html5","start":"0","timestamp":"1581366480","timezone":"-0700","version":"12.100"}
         */

        // fallback search types
        var search_types = ['show', 'non_episode'];

        // try to get search types from config
        var navConfig = OTTera.configuration.sections[0].nav.right;
        var navSearch = navConfig.filter(function(item) {
          return item.link && item.link.indexOf('nav://search') !== -1;
        });
        if (navSearch.length > 0) {
          navSearch = decodeURIComponent(navSearch[0].link.replace('nav://search/', ''));
          search_types = navSearch.split(',');
        }

        var searchConfig = search_types.map(function(searchType) {
          var searchRequestKey =  'search';
          if (searchType && searchType !== 'nav://search') {
            searchRequestKey =  'search_' + searchType;
          }

          if (window.OTTera.configuration.requests[searchRequestKey]) {
            var config = window.OTTera.configuration.requests[searchRequestKey];
            var params = $.extend({}, window.OTTera.params, config.parameters, {
              image_format: 'widescreen',
              key: searchKey
            });

            var requestSpec = {
              request: this.makeRequest(config.endpoint, params),
              title: config.title,
              endpoint: config.endpoint,
              params: params
            };

            if (searchType && searchType !== 'nav://search') {
              requestSpec.type = searchType;
            }

            return requestSpec;
          }
        }.bind(this));

        var searchRequests = searchConfig.map(function(config) {
          return config.request;
        });

        $.when.apply(null, searchRequests).done(function otteraSearchDone() {
          var haveResults = false;
          var $row;
          var totalResults = 0;

          Array.from(arguments).every(function(data, index) {
            var currentSearchConfig = searchConfig[index];

            if (data[0]) {
              data = data[0];
            }

            if (data && parseInt(data.num_results, 10) > 0) {
              haveResults = true;
              var result = data;
              totalResults += parseInt(data.num_results, 10);

              var row_id = 'ottera--row--objects--' + currentSearchConfig.type;
              var contentDiv = this.otteraBuildContentDiv('ottera--row--objects--' + currentSearchConfig.type, result.objects, {extra_display_fields: ['name']});

              $resultsArea.append('<h3 class="ottera--row--header">' + currentSearchConfig.title + '</h3>');
              $resultsArea.append(contentDiv);

              $row = $('#' + row_id);

              $row.data(this.datakeyLoadMore, {
                endpoint: currentSearchConfig.endpoint,
                parameters: currentSearchConfig.params,
                start: parseInt(result.num_results, 10)
              }).data(this.dataKeyRowStyle, {
                style: 'table',
                scale_factor: 1
              });

              $row.addClass('ottera-row-style--table')
                .addClass('ottera-row-format--widescreen');

              this.otteraSearchRef.trigger('init-carousels', [row_id]);

              this.setupAccessChecks('.ottera-access-check', '#' + row_id);
            }

            return true;
          }.bind(this));

          if (totalResults === 0 || haveResults === false) {
            $resultsArea.html('<p>' + Drupal.t('No results found for <i>@key</i>', {'@key': searchKey}) + '</p>');
          }
        }.bind(this));
      }.bind(this));

      // if there's an incoming key, search with it right away
      if (initialSearchKey) {
        this.otteraSearchRef.find('.ottera-js-search--form').trigger('submit');
      }
    },

    /**
     * Behaviors for the /browse endpoint
     * @backfilled as initBrowse
     */
    initOtteraBrowse: function () {
      var browseSection = window.OTTera.configuration.sections.filter(function (s) {
        return s.section === 'browse';
      });
      browseSection = browseSection.length >= 1 ? browseSection[0] : null;
      if (!browseSection) {
        return;
      }

      this.otteraShowContent(browseSection.items, this.otteraBrowseRef);

      this.otteraBrowseRef.on('init-carousels', this.initCarousels.bind(this));
    },

    /**
     * Behaviors for the linear/EPG block
     *
     * @backfilled as initLinear
     */
    initOtteraLinear: function(paramObj) {
      if (!window.OTTera.configuration.services.video.linear_player || (!this.otteraLinearRef && (!paramObj || !paramObj.channelId || paramObj.channelId !== 'lookup'))) {
        if (paramObj && (paramObj.url || paramObj.videoId)) {
          // if there's no place to show the video, try going to the node instead
          var link = paramObj.url ? paramObj.url : '/node/' + paramObj.videoId;
          window.location.href = link;
        } else {
          // no passed params, and no slot or configuration == no linear
          return false;
        }
      };

      if (!this.shouldLinearLoad()) return false;

      paramObj = paramObj || {};

      var defaultVideoId = OTTera.configuration.services.video.linear_player.current_object ? OTTera.configuration.services.video.linear_player.current_object.id : null;
      if (!defaultVideoId) {
        defaultVideoId = OTTera.configuration.services.video.linear_player.current_id ? OTTera.configuration.services.video.linear_player.current_id : null
      }

      var defaultChannelId = OTTera.configuration.services.video.linear_player.current_object ? OTTera.configuration.services.video.linear_player.current_object.linear_channel_id : null;

      var videoId = paramObj.videoId || this.otteraLinearCurrentVideo || defaultVideoId;
      var channelId = paramObj.channelId || this.otteraLinearCurrentChannel || defaultChannelId;
      var includeEPG = typeof paramObj.includeEPG !== 'undefined' ? paramObj.includeEPG : false;
      var mute = typeof paramObj.mute !== 'undefined' ? paramObj.mute : true; // default to muted

      if (!videoId && !channelId) return false;

      if (videoId && (!channelId || channelId === 'lookup')) {
        // blank the lookup
        channelId = null;

        this.makeRequest('search', {
          id: videoId
        }).then(function(response) {
          if (response.objects.length) {
            channelId = response.objects[0].linear_channel_id ? response.objects[0].linear_channel_id : null;
            if (channelId) {
              this.finishLoadingLinear(videoId, channelId, includeEPG, mute);
            }
          }
        }.bind(this))
      } else {
        return this.finishLoadingLinear(videoId, channelId, includeEPG, mute);
      }

      return true;
    },

    /**
     * Helper for initOtteraLinear to allow for async calls for channel ID
     * @param videoId
     * @param channelId
     * @param includeEPG
     * @param mute
     */
    finishLoadingLinear: function(videoId, channelId, includeEPG, mute) {
      // In case we need to scroll not quite to the top
      // var yCoord = $('#ottera-linear-player').offset() ? $('#ottera-linear-player').offset().top : 0;
      window.scrollTo(0, 0);

      if (channelId === this.otteraLinearCurrentChannel) return true;
      this.otteraLinearCurrentChannel = channelId;
      this.otteraLinearCurrentVideo = videoId;

      this.otteraLinearRef.html('<div id="ottera-linear-player">'+ this.getPlayerEmbedHtml() +'</div><div id="ottera-linear-epg"></div>');

      mute = typeof mute !== 'undefined' ? mute : true;

      var linearParams = Object.assign({}, {
        id: videoId,
        auto_play: {
          desktop: true,
          mobile: true
        },
        mute: mute
      });

      this.loadEmbeddedPlayer(linearParams, true);

      this.otteraLinearIsActive = true;

      if (includeEPG) {
        this.updateOtteraEPG('ottera-linear-epg', channelId);

        // refresh the EPG every 15 minutes
        Drupal.behaviors.codesbasePublic.epgInterval = window.setInterval(this.updateOtteraEPG.bind(this, 'ottera-linear-epg', channelId), (15 * 60 * 1000));

        $(window).on('beforeunload.epgtimer', function cleanUpEPGTimer() {
          window.clearInterval(Drupal.behaviors.codesbasePublic.epgInterval);
        });
      }

      return true;
    },

    /**
     * Checks the current section and returns whether the linear player should
     * be allowed to load
     *
     * @returns {boolean}
     */
    shouldLinearLoad: function() {
      if (this.debug && this.debug.hasOwnProperty('killLinear') && this.debug.killLinear === true) return false;

      var services = window.OTTera.configuration.services;
      if (services.video && services.video.linear_player && services.video.linear_player.sections) {
        var sectionsWithLinear = services.video.linear_player.sections;
        return sectionsWithLinear.indexOf(this.currentSection) !== -1;
      }

      return false;
    },

    /**
     *
     * @param root_id
     * @param primary_id
     *
     * @backfilled
     */
    updateOtteraEPG: function(root_id, primary_id) {
      // console.log('updateOtteraEPG', this.flickityOptions, root_id, primary_id);

      var epgParams = {
        parent_type: 'linear_channel',
        parent_id: primary_id,
        linear_channel_id: primary_id
      };

      this.makeRequest('getvideosegments', epgParams).then(function (data) {
        var objects = data.objects;
        if (!objects || objects.length <= 0) return;

        this.renderEpgRow(root_id, data, epgParams);

        $('#' + root_id).on('init-carousels', this.initCarousels.bind(this));
      }.bind(this));
    },

    /**
     * Renders an EPG row, either for the top level or for the regular rows
     *
     * @param root_id
     * @param data
     * @param params
     * @param title
     */
    renderEpgRow: function(root_id, data, params, title) {
      var $root = $('#' + root_id);
      title = title || "";

      var objects = data.objects ? data.objects : [];

      // some behaviors may be different when we're in regular rows vs the player region
      var isInRow = root_id !== 'ottera-linear-epg';

      // when we reload, kill off flickity first
      if ($root.hasClass('flickity-enabled')) {
        $root.flickity('destroy');
      }

      $root.html('');

      // JS returns milliseconds, we want seconds
      var currentTimestamp = Math.floor(Date.now() / 1000);

      var epgContent = '';
      if (title) {
        epgContent += '<h3 class="ottera--row--header">' + title + '</h3>';
      }

      var id_end = root_id.match(/--(\w+)$/);
      var id = id_end ? ('ottera--row--objects' + id_end[0]) : '';
      epgContent += '<div class="ottera--row--objects" id="' + id + '">';

      for (var i = 0; i < objects.length; i++) {
        var epg_obj = objects[i];
        var epgBlock = this.buildEPGBlock(epg_obj, isInRow);

        epgContent += epgBlock;
      }

      epgContent += '</div>';

      epgArr.push(objects);

      var $objects = $root.html(epgContent).find('.ottera--row--objects');
      // $objects.flickity(this.flickityOptions);

      var $epgSlider = $('#'+id);

      $epgSlider.data(this.datakeyLoadMore, {
        endpoint: 'getvideosegments',
        parameters: params,
        start: parseInt(objects.length, 10)
      });

      $root.trigger('init-carousels', [id]);

      this.addFlickityEvents($epgSlider);
    },
    /**
     * Like otteraBuildObject, but for EPG items
     * (i.e. more fields to process and display)
     *
     * @param epg_obj
     * @param isInRow
     * @returns {string}
     */
    buildEPGBlock: function(epg_obj, isInRow) {
      var endSeconds = parseInt(epg_obj.segment_end_time, 10);

      // convert times to ms for JS conversion
      var segStart = new Date(parseInt(epg_obj.segment_start_time, 10) * 1000);
      var segEnd = new Date(endSeconds * 1000);
      var timeFormat = 'h:mma';
      var dateFormat = 'M/D';

      var now = new Date();
      var nowDateString = date.format(now, dateFormat);

      var timeOffset = 0; //segStart.getTimezoneOffset(); // minutes to be subtracted

      var startDateTime = date.addMinutes(segStart, 0 - timeOffset);
      var endDateTime = date.addMinutes(segEnd, 0 - timeOffset);

      var startDateString = date.format(startDateTime, dateFormat);

      // add the start date if necessary
      var startDate = '';
      if (startDateString !== nowDateString) {
        startDate = '<span class="ottera--epg--date">' + startDateString + '</span> ';
      }

      var startTime = date.format(startDateTime, timeFormat);
      var endTime = date.format(endDateTime, timeFormat);

      // add links only if we're in a regular row (i.e. not the top level block)
      var epgBlock = '<div class="ottera--epg">';

      epgBlock +=
        //'<a href="/node/' + epg_obj.video_id + '" title="Watch \'' +
        // epg_obj.name + '\' now">' +
        (isInRow ? '<a href="' + epg_obj.link + '" class="ottera-link-select" title="Watch \'' + epg_obj.parent_name + '\' now" data-ottera-type="' + epg_obj.type + '">' : '');

      epgBlock += '<div class="ottera--epg--info" data-object="'+ epg_obj.id +'"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#ffffff"  d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM256 128c17.67 0 32 14.33 32 32c0 17.67-14.33 32-32 32S224 177.7 224 160C224 142.3 238.3 128 256 128zM296 384h-80C202.8 384 192 373.3 192 360s10.75-24 24-24h16v-64H224c-13.25 0-24-10.75-24-24S210.8 224 224 224h32c13.25 0 24 10.75 24 24v88h16c13.25 0 24 10.75 24 24S309.3 384 296 384z"/></svg></div>';

      epgBlock += '<div class="ottera--epg--thumbnail">';
      if (epg_obj.thumbnail_url) {
        epgBlock += '<img src="' + epg_obj.thumbnail_url + '" alt="' + epg_obj.name + '" loading="lazy">';
      } else {
        epgBlock += '&nbsp;';
      }
      epgBlock += '</div>';

      epgBlock += '<div class="ottera--epg--text">' +
        '<div class="ottera--epg--time">' + startDate + startTime + ' – ' + endTime + '</div>' +
        '<h3 class="ottera--epg--title">' + epg_obj.name + '</h3>' +
        '</div>' +
        (isInRow ? '</a>' : '') +
        // '</a>' +
        '</div>';

      return epgBlock;
    },

    /**
     * Clear the linear block
     */
    clearOtteraLinear: function() {
      if (!window.OTTera.configuration.services.video.linear_player) return;

      window.OTTera.configuration.services.video.linear_player.current_object = null;
      window.OTTera.configuration.services.video.linear_player.current_id = null;

      this.otteraLinearRef.html('');

      this.otteraLinearIsActive = false;
      this.otteraLinearCurrentChannel = null;

      window.clearInterval(Drupal.behaviors.codesbasePublic.epgInterval);
    },

    /**
     * @backfilled
     * @returns {string}
     */
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
                        <div id="video_player" style="position:absolute; top:0; left:0; left:0; right:0; bottom:0;"></div> \
                      </div> \
                    </div>';
    },

    /**
     * Initializes Flickity carousels/sliders
     *
     * @param evt
     * @param rowId
     *
     * @backfilled
     */
    initCarousels: function (evt, rowId) {
      var $row = $('#' + rowId);

      // console.log('init carousels for row with data', rowId,
      // $row.data('ottera-load-more'));

      var styleOpts = $row.data(this.dataKeyRowStyle);
      if (!styleOpts) {
        styleOpts = {
          style: 'table'
        }
      };

      if (this.rowStyles.indexOf(styleOpts.style) === -1) {
        styleOpts.style = this.rowStyles[0];
      }

      var options = styleOpts.style === 'slider' ? this.flickityOptionsSlider : this.flickityOptions;
      // channels row is different - uses slider style, but should behave like a regular row
      if ($row.hasClass('ottera-row-type--channels')) options = this.flickityOptions;

      $row.flickity(options);

      $row.data(this.dataKeyIsLoading, false);

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
            var loadMore = $row.data(this.datakeyLoadMore);
            if (!loadMore) {
              return;
            }

            if ($row.data(this.dataKeyIsLoading) === true) {
              return;
            }

            // console.log('last cell selected in row', rowId, idx);
            // console.log('will load more using ottera-load-more', loadMore);

            var params = $.extend({}, loadMore.parameters, {
              start: loadMore.start
            });

            $row.data(this.dataKeyIsLoading, true);

            this.makeRequest(loadMore.endpoint, params).then(function (response) {
              if (!response || !response["objects"] || response["objects"].length === 0) {
                $row.data(this.datakeyLoadMore, null);
                return;
              }

              // these come through as strings
              var start_index = parseInt(response.start_index, 10);
              var num_results = parseInt(response.num_results, 10);
              var total_results = parseInt(response.total_results, 10);

              var cells = '';
              for (var j = 0; j < response["objects"].length; j++) {
                if (loadMore.endpoint !== 'getvideosegments') {
                  cells += this.otteraBuildObject(response["objects"][j], null, loadMore);
                } else {
                  var isInRow = $row.parents('#ottera-linear-epg').length === 0;
                  cells += this.buildEPGBlock(response["objects"][j], isInRow);
                }
              }

              epgArr.push(response["objects"]);

              $row.flickity('append', $(cells));
              $row.removeClass('flickity--at-end');

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
              $row.data(this.datakeyLoadMore, newLoadMore);
              $row.data(this.dataKeyIsLoading, false);
            }.bind(this));
          }
        }.bind(this));
      }

      this.addFlickityEvents($row);

      $row.on('mouseenter mouseleave focus blur', '.ottera--row--item', this.toggleViewingOverlay.bind(this, '.ottera--row--item'));

      $row.on('click', '.ottera--row--item', this.catchModalLinks.bind(this));

      this.engageFlickityFix();
    },

    /**
     * Add various behaviors to a flickity slider
     *
     * @param $el
     *   jQuery selector for the enabled element
     */
    addFlickityEvents: function($el) {
      // when the carousel is NOT in its starting position, add a class
      $el.on('change.flickity', function(evt, idx) {
        var className = 'flickity--past-start';

        if (idx > 0) {
          if (!$el.hasClass()) {
            $el.addClass(className);
          }
        } else {
          $el.removeClass(className);
        }

        // when the carousel is at its end, add a class
        // (when cells are appended above, this class is removed)
        var endClassName = 'flickity--at-end';
        var flkty = $el.data('flickity');

        var visibleSlideCount = Math.ceil(flkty.size.outerWidth / flkty.selectedSlide.outerWidth);

        if ((idx + visibleSlideCount) >= flkty.cells.length) {
          $el.addClass(endClassName);
        } else {
          $el.removeClass(endClassName);
        }
      });
    },

    /**
     * Callback handling resize event
     *
     * @backfilled
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

      window.OTTera.params.device_type = device;
      // console.log('OtteraResize', window.OTTera.params);

      // make sure any players and images aren't too big
      var $playerRegion = $('.click-to-play');

      if ($playerRegion) {
        var $previewImg = $playerRegion.find('.video--preview--image img');
        var $overlayBgImg = $playerRegion.find('.premium-message--bg');

        var notTooTinySize = 250;
        var dummyHeight = $('#dummy').outerHeight(true);
        var playerDesiredHeight = dummyHeight > notTooTinySize ? dummyHeight : notTooTinySize;

        if ($previewImg.height() > $previewImg.width() && $previewImg.height() > playerDesiredHeight) {
          $playerRegion
            .height(playerDesiredHeight)
            .css('overflow', 'hidden');

          $previewImg.css({
            height: playerDesiredHeight,
            width: 'auto'
          });

          $overlayBgImg.css({
            height: playerDesiredHeight,
            width: 'auto',
            left: '50%',
            transform: 'translateX(-50%)'
          });
        }
      }
    },

    /**
     * Helper function to retrieve a URL param by name
     *
     * @param name
     * @param url
     * @returns {string|null}
     *
     * @backfilled
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
     * Update the URL immediately with a new search param
     * (or return the value)
     *
     * @param param
     * @param value
     * @param returnIt
     */
    addUrlParam: function(param, value, returnIt) {
      returnIt = returnIt === true || false;
      var newSearch = '';

      if (window.location.search !== '') {
        newSearch = window.location.search + '&' + param + '=' + value;
      } else {
        var prefix = window.location.search.indexOf('?') === 0 ? '' : '?';

        newSearch = prefix + param + '=' + value;
      }

      if (returnIt) {
        return newSearch;
      } else {
        window.location.search = newSearch;
      }
    },

    /**
     * Replaces a query param in the URL, and either sets in place or returns
     *
     * @param param
     * @param value
     * @param returnIt
     * @returns {string|*}
     */
    replaceUrlParamValue: function (param, value, returnIt) {
      returnIt = returnIt === true || false;

      var paramExists = window.location.search !== '' && window.location.search.indexOf(param+'=') !== -1;
      if (!paramExists) {
        if (returnIt) {
          return this.addUrlParam(param, value, returnIt);
        } else {
          return this.addUrlParam(param, value);
        }
      } else {
        var regex = new RegExp('(' + param + '=)[^\&]+');
        var newUrl = window.location.href.replace(regex, '$1' + value);

        if (returnIt) {
          return newUrl;
        } else {
          return window.location.href = newUrl;
        }
      }
    },

    /**
     * Gets the active regcode in this order:
     *
     * 1.  From drupalSettings.codesPartner if available
     * 2.  From the URL query params
     * 3.  From the form on the page via OTTera.getRegcode
     *
     * @backfilled
     */
    getActiveRegcode: function () {
      // default regcode comes from Drupal settings, and is preferred if
      // available
      if (drupalSettings.codesPartner && drupalSettings.codesPartner.defaultRegcode) {
        if (drupalSettings.codesPartner.defaultRegcode.length) {
          return drupalSettings.codesPartner.defaultRegcode;
        }
      }

      // fallback and use the regcode from the URL if it's not otherwise stored
      var urlRegcode = this.getUrlParameterByName('regcode');
      if (urlRegcode) {
        return urlRegcode;
      }

      return OTTera.getRegcode();
    },

    /**
     * Add collection behaviors
     *
     * @backfilled
     */
    setupCollection: function () {
      var linkClass = '.collection--item';
      $('.collection--items').on('mouseenter mouseleave focus blur', linkClass, this.toggleViewingOverlay.bind(this, linkClass));
    },

    /**
     * Add show behaviors
     *
     * @backfilled
     */
    setupShow: function () {
      var linkClass = '.episode--item';
      $('.show--season-episodes').on('mouseenter mouseleave focus blur', linkClass, this.toggleViewingOverlay.bind(this, linkClass));

      var id = $('.show--container--top').data('ottera-id');

      this.showMetaFallback(id);
    },

    /**
     * Add video behaviors
     */
    setupVideo: function () {
      var id = $('.video--preview').data('ottera-id');

      this.videoMetaFallback(id);

      this.setupTrailerButtons(id);
    },

    /**
     * Activate trailer buttons, if there are any, switching from trailer to
     * main feature
     */
    setupTrailerButtons: function(id) {
      this.getItemDataAndCache(id).then(function (ottObj) {
        // get the trailer information
        var $trailerArea = $('.associations--video');
        var $playerArea = $('.click-to-play');
        var $overlay = $('.premium-message');

        if (ottObj.associations && $trailerArea.length > 0) {
          var buttonsStr = '';

          for (var a = 0; a < ottObj.associations.length; a++) {
            var assoc = ottObj.associations[a];
            if (assoc.association_type === 'trailer') {
              var entryIdMatch = assoc.video_url.match(/\/entryId\/(\w+)\//);

              // might need to base64 decode the associated trailer's URL payload first
              if (!entryIdMatch) {
                var payload = this.getUrlParameterByName('payload', assoc.video_url);
                var video_url = atob(payload);
                entryIdMatch = video_url.match(/\/entryId\/(\w+)\//);
              }

              var entryId = entryIdMatch[1] ? entryIdMatch[1] : '';

              var assocTitle = assoc.association_title ? assoc.association_title : Drupal.t('Trailer');

              buttonsStr += '<button class="button button--trailer" data-play-id="'+ assoc.id +'" data-parent-id="'+ id +'" data-entry-id="'+ entryId +'"><i class="fa fa-play"></i> <span class="association--title">'+ assocTitle +'</span></button>'
            }
          }

          buttonsStr += '<button class="button button--original" data-play-id="' + id +'" style="display:none;"><i class="fa fa-play"></i> <span class="original--title">' + ottObj.name +'</span></button>';

          $trailerArea.html(buttonsStr);

          var $trailerButtons = $trailerArea.find('.button--trailer');
          if ($trailerButtons.length === 0) return;

          var $originalButton = $trailerArea.find('.button--original');

          $originalButton.on('click', function(evt) {
            evt.preventDefault();
            $overlay.show();
            $playerArea.removeClass('trailer');

            var playId = $originalButton.data('playId');

            this.checkAccessAndPrompt(playId, function () {
              this.loadEmbeddedPlayer({
                id: playId,
                mute: false
              }, true);
            }.bind(this));

            $trailerButtons.show();
            $originalButton.hide();
          }.bind(this));

          $originalButton.hide();

          $trailerButtons.each(function(i, el) {
            var $btn = $(el);

            $btn.on('click', function(evt) {
              evt.preventDefault();

              $overlay.hide();
              $playerArea.addClass('trailer');

              var entryId = $btn.data('entryId');
              var parentId = $btn.data('parentId');
              var trailerId = $btn.data('playId');

              // collect captions for this item, if any
              var parentData = this.getItemFromCache(parentId);
              var trailerObj = parentData.associations.filter(function(assoc) {
                return assoc.id == trailerId;
              });
              if (trailerObj && trailerObj.length > 0) {
                trailerObj = trailerObj[0];
              }

              var sourcesConfig = {};
              if (trailerObj.captions) {
                sourcesConfig.captions = [];
                for (var c = 0; c < trailerObj.captions.length; c++) {
                  var cap = trailerObj.captions[c];
                  var captionObj = {
                    url: cap.caption_url,
                    language: cap.language,
                    'default': cap.default,
                    type: cap.caption_url.substr(-3, 3)
                  }
                  sourcesConfig.captions.push(captionObj);
                }
              }

              // swap the player URL for the trailer, no access check since
              // these will almost always be child_only, and therefore not
              // directly accessible with API calls
              $('#video_player').html('');
              this.loadKalturaPlayer('video_player', trailerObj, sourcesConfig);

              $trailerButtons.hide();
              $originalButton.show();
            }.bind(this));
          }.bind(this));
        }
      }.bind(this));
    },

    /**
     * Static page behaviors
     */
    setupStaticPages: function() {
      var currentLang = this.getCurrentLanguage();
      if (currentLang !== 'en') {
        var supportedFileLangs = (window.OTTera.configuration.services.general && window.OTTera.configuration.services.general.static_files && window.OTTera.configuration.services.general.static_files.languages) ? window.OTTera.configuration.services.general.static_files.languages : [];
        // only attempt translation if the language is supposed to be supported
        if (supportedFileLangs.indexOf(currentLang) === -1) {
          return;
        }

        // translate the iframe/s3 page links
        var $translatableIframe = $('iframe[src^="https://assets.static-ottera"]');
        if ($translatableIframe.length > 0) {
          var newSrc = $translatableIframe.attr('src').replace(/\/\w+\.html/, '/'+ currentLang +'$&');
          $translatableIframe.attr('src', newSrc);
        }
      }
    },

    /**
     * Callback for items that display a premium overlay dynamically
     * @param itemClass
     * @param evt
     *
     * @backfilled
     */
    toggleViewingOverlay: function (itemClass, evt) {
      // disable these overlays entirely on v14,
      // since we have to call getmediaunlock to ensure access there
      if (this.otteraVersionAtLeast(14) && this.otteraIsLoggedInJS()) return;

      var $link = $(evt.target).closest(itemClass);
      var itemId = $link.data('ottera-id');
      var $overlay = $link.find('.premium-overlay');

      if (!$overlay.length) {
        return;
      }

      // make sure premium users never see the overlay, and always have the
      // real URL
      var userHasAccess = this.userHasAccess(itemId);
      if (userHasAccess || this.shouldHidePremiumOverlay()) {
        $link.attr('href', $link.data('ottera-url'));
        $overlay.hide();
        return;
      }

      // non-premium users get the upgrade URL, and see the overlay
      if (evt.type === 'mouseenter' || evt.type === 'focus') {
        var overlayConfigs = this.getOverlayItems();
        // $link.attr('href', overlayConfigs.link);
        $overlay.addClass('shown');
      }
      else {
        $overlay.removeClass('shown');
      }
    },

    /**
     * Search for an item in the API and cache it
     * Returns a promise, whether cached or not
     * (Cache only lives until a reload)
     *
     * Should be use by any function that needs to access items from the API
     *
     * @see checkAccessAndPrompt
     *
     * @param itemId
     * @returns {Promise<unknown>|jQuery}
     */
    getItemDataAndCache: function(itemId) {
      if (this.getItemFromCache(itemId)) {
        var itemPromise = jQuery.Deferred();
        itemPromise.resolve(this.getItemFromCache(itemId));
        return itemPromise;
      }

      return this.makeRequest('search', {
        id: itemId
      }).then(function(response) {
        // strip out the objects if they exist
        var itemData;

        if (response.hasOwnProperty('objects')) {
          if (response.objects[0]) {
            itemData = response.objects[0];
          }
          else {
            itemData = response.objects;
          }
        } else {
          itemData = {};
        }

        // save the data
        this.setItemInCache(itemId, itemData);

        var itemPromise = jQuery.Deferred();
        itemPromise.resolve(itemData);
        return itemPromise;
      }.bind(this));
    },

    /**
     * To avoid massive sparse arrays, add a string prefix
     * @param itemId
     */
    getItemFromCache: function(itemId, bin) {
      if (!bin) {
        bin = 'item';
      }

      var item;

      switch (bin) {
        case 'product':
          item = this.productCache[this.cachePrefix + itemId];
          break;
        default:
          item = this.itemCache[this.cachePrefix + itemId];
          break;
      }

      return item ? item : null;
    },

    /**
     * To avoid massive sparse arrays, add a string prefix
     * @param itemId
     */
    setItemInCache: function(itemId, data, bin) {
      if (!bin) {
        bin = 'item';
      }

      switch (bin) {
        case 'product':
          this.productCache[this.cachePrefix + itemId] = data;
          break;
        default:
          this.itemCache[this.cachePrefix + itemId] = data;
          break;
      }

      return true;
    },

    /**
     * Check access for an item, then call successCallback or noAccessCallback
     * as appropriate.  noAccessCallback is prompts the user by default.
     */
    checkAccessAndPrompt: function(itemId, successCallback, noAccessCallback, eventContext) {
      if (!successCallback) successCallback = $.noop();
      if (!noAccessCallback) noAccessCallback = this.showProductOptionsOrRedirect.bind(this);
      if (!eventContext) eventContext = 'click';

      this.getItemDataAndCache(itemId)
        .then(function (itemData) {
          // Version 14 and above uses a different permissions model
          if (this.otteraVersionAtLeast(14)) {
            // If the item has required_permissions set, we need to call getmediaunlock
            if (itemData.hasOwnProperty('required_permissions') && itemData.required_permissions.length > 0) {
              this.makeRequest('getmediaunlock', {
                id: itemId
              }).then(function(response) {
                // getmediaunlock returns an empty array when you have access
                if (response.objects.length === 0) {
                  console.log('checkAccessAndPrompt: user has access (unlocked) (v14+)');
                  successCallback();
                  return true;
                } else {
                  // If we don't have access, we pop a modal with what to do
                  // (buy, log in, register, etc)
                  noAccessCallback(response.objects[0], eventContext);
                }
              }.bind(this));
            } else {
              // if the item doesn't have required_permissions (which is unlikely)
              // use legacy permission check
              if (this.hasLegacyPermission(itemData)) {
                console.log('checkAccessAndPrompt: user has access (legacy permissions) (v14+)');
                successCallback();
                return true;
              } else {
                noAccessCallback(itemData, eventContext);
              }
            }
          } else {
            // version 13 and earlier stick with legacy/premium permissions
            var userHasAccess = this.hasLegacyPermission(itemData);
            if (!userHasAccess) {
              noAccessCallback(itemData, eventContext);
            }
            else {
              console.log('checkAccessAndPrompt: user has access (legacy permission) (< v14)');
              successCallback();
              return true;
            }
          }
        }.bind(this));
    },

    processProductData: function(itemId, productData) {
      // console.log('Going to save some product data', productData);

      // strip out the objects if they exist
      if (productData.hasOwnProperty('objects')) {
        if (productData.objects[0]) {
          productData = productData.objects[0];
        }
        else {
          productData = productData.objects;
        }
      }

      // save the data
      this.setItemInCache(itemId, productData, 'product');

      return productData;
    },

    /**
     * If a special link is clicked in a context where it doesn't do it's
     * default behavior, route through this helper function to make it happen
     *
     * @param itemClass
     * @param evt
     */
    catchModalLinks: function(evt) {
      var $link = $(evt.currentTarget);

      if ($link.attr('href').search('#login') !== -1) {
        evt.preventDefault();
        this.loadLoginForm();
      }
    },

    /**
     * When overlays are displayed, get the correct messaging (premium or
     * reg_users_only)
     */
    getOverlayItems: function() {
      if (this.settings.commerce === false) {
        return this.settings.reg_only;
      } else {
        return this.settings.premium;
      }
    },

    /**
     * Helper function determines whether overlays should be hidden/removed,
     * and regular viewing URLs restored
     */
    shouldHidePremiumOverlay: function() {
      // if we're commerce-enabled on v14 (tvod, etc), don't proactively hide these
      // TODO confirm whether we should have or hide these
      // if (this.settings.commerce === true && parseInt(OTTera.params.version, 10) >= 14) return false;

      return this.otteraIsPremiumUser() || (this.settings.commerce === false && this.otteraIsLoggedInJS());
    },

    /**
     * Any static params in page links that need adjusted are adjusted
     *
     * @see this.otteraResize for another param adjuster
     *
     * @backfilled
     */
    updateAPIParams: function() {
      var $appLinks = $('.app-deep-link');
      if ($appLinks.length) {
        var link = $appLinks.attr('href');

        link = link.replace(/platform=\w+(&?)/, 'platform=' +  window.OTTera.detectRedirectPlatform() +'$1');
        link = link.replace(/device_type=\w+(&?)/, 'device_type=' +  window.OTTera.detectDeviceType() +'$1');

        $appLinks.attr('href', link);
      }
    },

    /**
     * Get the current language to use for API calls,
     * first from the URL path if appropriate, then from the browser
     *
     * @returns {string}
     */
    getCurrentLanguage: function() {
      // get the language from the cookie as the first option
      if (window.OTTera && window.OTTera.getCookie(this.languageCookieName)) {
        return window.OTTera.getCookie(this.languageCookieName).slice(0,5); // quick sanitize
      }

      // Somehow, sometimes the language is getting set to an unavailable option
      if (this.settings.language && this.settings.available_languages) {
        if (this.settings.available_languages.indexOf(this.settings.language) !== -1) {
          return this.settings.language;
        }
      }

      if (!this.settings.available_languages) return "en";

      for (var i = 0; i < this.settings.available_languages.length; i++) {
        // if we're looking at a page like "/en/feature/movie-name", use that as the language
        if (window.location.pathname.search('/' + this.settings.available_languages[i]) === 0) {
          return this.settings.available_languages[i];
        }
      }

      // if there's nothing in the path, check what the user's browser says
      var userLangs = getNavigatorLanguages();

      // make sure we return something (English the default)
      var preferredLanguage = 'en';

      if (userLangs.length > 0) {
        var preferredLang = userLangs[0];

        // trim en-US or the like to just en
        preferredLanguage = preferredLang.split('-')[0].toLowerCase();
      }

      return preferredLanguage;
    },

    /**
     * Adds a fix to help with slider/carousel performance
     * Gated to only be added once
     *
     * @see https://github.com/metafizzy/flickity/issues/959
     * @see https://gist.github.com/bakura10/b0647ef412eb7757fa6f0d2c74c1f145
     *
     * @backfilled
     */
    engageFlickityFix: function() {
      if (this.flickityFixed) return;

      this.flickityFixed = true;

      var touchingCarousel = false,
        touchStartCoords;

      document.body.addEventListener('touchstart', function(e) {
        if ($(e.target).closest('.flickity-slider').length) {
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
     * Make links that should always open new tabs, do so
     * (unless it's a COPPA site)
     */
    setExternalLinkTargets: function() {
      if (this.settings.coppa) return;

      var attrs = {
        'target': '_blank',
        'rel': 'noopener noreferrer',
      };

      // links in the devices block
      $('#block-devices').find('a').attr(attrs);

      // links on the devices page
      $('.devices-body').find('a').attr(attrs);
    },

    /**
     * Look for the div created by /ads.js (if that file is even loaded)
     * If it's there, ads are not blocked
     *
     * @returns {boolean}
     */
    adsAreBlocked: function() {
      var $script = $('script[src^="/dfp.js"]');
      var scriptExists = $script.length && $script.length > 0;

      var adDivExists = !!document.getElementById(this.settings.ads.divId);

      return scriptExists && !adDivExists;
    },

    /**
     * Save the user's permissions
     */
    saveUserPermissions: function() {
      var user = OTTera.getUser();

      if (this.permissions == null) {
        this.permissions = [];
      }
      if (user && user.permissions != null) {
        for (var pIdx in user.permissions) {
          if (!user.permissions.hasOwnProperty(pIdx)) continue;
          var permission = user.permissions[pIdx];

          if (this.arrayContainsObject(this.permissions, permission) === false && permission !== "TVOD") {
            this.permissions.push(permission);
          }
        }
      } else {
        this.permissions = [];
      }
    },

    /**
     * Get the user's permissions
     */
    getUserPermissions: function() {
      var user = OTTera.getUser();

      if (user && user.permissions != null) {
        return user.permissions;
      } else {
        return [];
      }
    },

    /**
     * Does the user have some kind of access to watch this item?
     *
     * @see codeshtml5 > Persistence::hasPermissions
     *
     * @param id
     */
    userHasAccess: function(id) {
      // TODO add support for limiting free access
      // codeshtml5:freeUsageLimitsEnabled and Persistence::isContentLocked

      // TODO should this be product instead?
      var product = this.getItemFromCache(id);

      // On v14+ we can check the item's permissions first, if available
      var contentItem = (product && product.packages) ? product.packages[0].featured[0] : null;
      if (this.otteraVersionAtLeast(14)) {
        if (!contentItem) {
          // if there's no content item in product cache, we called getmediaunlock and got an empty answer, which means grant access
          return true;
        } else if (!contentItem.required_permissions || !contentItem.required_permissions.length) {
          // if the content item exists, but doesn't have required permissions set,
          // check for premium or registered access
          return this.hasLegacyPermission(contentItem);
        }
      }

      // if we don't have packages in the product data, we're using pre v13 (premium, no TVOD) flow
      if (product && !product.hasOwnProperty('packages')) {
        return this.hasLegacyPermission(product);
      }

      if (contentItem && contentItem.required_permissions) {
        var validPermissions = this.getValidPermissions(contentItem.required_permissions);
        if (validPermissions != null) {
          var isTVODRental = false;
          for (var i = 0; i < validPermissions.length; i++) {
            var permission = validPermissions[i];
            if (permission.indexOf("TVOD_EXP") > -1) {
              isTVODRental = true;
            }
          }
          return !isTVODRental;
        } else {
          return false;
        }
      }

      // ultimate fallback is no access
      return false;
    },

    /**
     * Returns the permissions a user has that match an object/product's
     * requirements
     *
     * this.permissions is the user's cached permissions
     *
     * @param permissions
     * @returns {[]|*}
     */
    getValidPermissions: function(permissions) {
      if (permissions == null || permissions.length === 0) {
        return permissions;
      }
      var permissionsSets = [];
      if (typeof(permissions[0]) === 'string') {
        permissionsSets.push(permissions);
      } else if (permissions[0] instanceof Array) {
        permissionsSets = permissions;
      }

      var validPermissionsSet = [];
      for (var pSetIdx in permissionsSets) {
        if (!permissionsSets.hasOwnProperty(pSetIdx)) continue;
        var permissionsSet = permissionsSets[pSetIdx];

        var hasPermissions = true;
        for (var pIdx in permissionsSet) {
          if (!permissionsSet.hasOwnProperty(pIdx)) continue;

          var permission = permissionsSet[pIdx];

          if (this.arrayContainsObject(this.getUserPermissions(), permission) === false) {
            hasPermissions = false;
            break;
          }
        }
        if (hasPermissions === false) {
          validPermissionsSet = null;
        } else {
          validPermissionsSet = permissionsSet;
        }
        if (validPermissionsSet != null) {
          break;
        }
      }
      return validPermissionsSet;
    },

    /**
     * Returns true if the user has legacy premium access for this item
     *
     * @see html5:hasPremiumPermission if needed
     *
     * @returns {boolean}
     */
    hasLegacyPermission: function(productData) {
      if (productData.premium_content === 'false') {
        if (productData.is_premium === 'true' || productData.reg_users_only === 'true') {
          return this.otteraIsLoggedInJS();
        } else {
          return true;
        }
      } else {
        return this.otteraIsPremiumUser();
      }
    },

    /**
     * Show the products that go with a set of permissions
     *
     * @param unlockObject - an API object to be accessed
     *
     * @param eventContext - click or load
     */
    showProductOptionsOrRedirect: function(unlockObject, eventContext) {
      var allProducts = (window.OTTera.configuration.services.video && window.OTTera.configuration.services.video.products) ? window.OTTera.configuration.services.video.products : [];
      if (!allProducts.length) return;

      // where to put the form
      var ref = window.OTTera.refs.modals.form ? window.OTTera.refs.modals.form : this.formModal;
      var modalCallback = window.OTTera.refs.modals.form ? window.OTTera.openFormModal : this.openFormModal;
      if (!ref) return;

      // for < v14, pop the login form or go to upgrade page
      var hasPackage = unlockObject.hasOwnProperty('packages') && unlockObject.packages[0];
      if (!hasPackage && eventContext === 'click') {
        if (unlockObject.is_premium === 'true' || unlockObject.reg_users_only === 'true') {
          // if the user is logged in already, they need to upgrade
          if (this.otteraIsLoggedInJS()) {
            window.location.href = '/upgrade';
          } else {
            // otherwise they need to log in first
            var loginCallback = window.OTTera.refs.modals.form ? window.OTTera.loadLoginForm : this.loadLoginForm.bind(this);
            loginCallback();
          }
        }
        return;
      }

      var modalPackage = unlockObject.packages[0];
      var viewableItem = modalPackage.featured[0];
      var filteredProducts = modalPackage.packages;

      var termsHtml = '';

      var productChoicesForm = '<form id="form--product-offerings">';
      if (viewableItem.widescreen_thumbnail_url) {
        productChoicesForm += '<div class="product-offering--bg"><img src="'+viewableItem.widescreen_thumbnail_url+'" alt=""></div>';
      }
      productChoicesForm += '<div class="product-offering--content">';
      productChoicesForm += '<h3 class="product-offering--item">'+viewableItem.name+'</h3>';
      productChoicesForm += '<p class="product-offering--notice">'+modalPackage.notice+'</p>';

      if (!window.OTTera.isAuthenticated() || !filteredProducts.length) {
        productChoicesForm += '<div class="product-offering--actions"><button class="button login">' + Drupal.t('Login / Register') + '</button> <button class="button secondary cancel" data-close aria-label="' + Drupal.t('Cancel') + '">' + Drupal.t('Cancel') + '</button></div>';
      } else {
        for (var p = 0; p < filteredProducts.length; p++) {
          var product = filteredProducts[p];

          var productChecked = (product.default === '1' || filteredProducts.length === 1) ? 'checked="checked"' : '';
          productChoicesForm += '<label><input name="product-offering-sku" type="radio" value="'+product.sku+'" data-reference-type="'+product.reference_type+'" data-reference-id="'+product.reference_id+'" ' + productChecked +' data-purchase-type="'+product.purchase_type+'" data-product-type="'+product.product_type+'" /><span class="product-offering--price">'+product.price+'</span> <span class="product-offering--term">'+product.term+'</span>';

          if (product.note) {
            productChoicesForm += '<span class="product-offering--note">'+product.note+'</span>';
          }

          productChoicesForm += '</label>';
        }
        productChoicesForm += '<div class="product-offering--actions"><button class="button checkout">'+modalPackage.prompt+'</button> <button class="button secondary cancel" data-close aria-label="' + Drupal.t('Cancel') + '">' + Drupal.t('Cancel') + '</button>';

        if (modalPackage.hasOwnProperty('skip') && modalPackage.skip.enabled) {
          productChoicesForm += '<button class="button skip">'+modalPackage.skip.prompt+'</button>';
        }

        if (modalPackage.hasOwnProperty('terms') && modalPackage.terms !== '') {
          productChoicesForm += '<button class="product-offering--link terms">' + Drupal.t('View Terms & Conditions') + '</button>';
          termsHtml = '<div class="product-offering--terms">' + modalPackage.terms + '<div class="product-offering--actions"><button class="button terms--close">' + Drupal.t('« Back') + '</button></div></div>';
        }

        productChoicesForm += '</div>';
      }
      productChoicesForm += '</div></form>';

      ref.find('#ottera-modal-inner').html(productChoicesForm);

      ref.on('click', function handleProductClick(evt) {
        var $t = $(evt.target);
        if ($t.is('.cancel')) {
          evt.preventDefault();
          this.closeFormModal();
        } else if ($t.is('.checkout')) {
          evt.preventDefault();

          var $selectedOffering = $('input[name=product-offering-sku]:checked');

          var selectedSku = $selectedOffering.val();

          if (!selectedSku) {
            window.alert(Drupal.t('Please select an item before checking out.'));
            return;
          }

          var purchaseParams = {
            products: selectedSku
          };

          if ($selectedOffering.data('reference-id')) {
            purchaseParams.reference_id = $selectedOffering.data('reference-id');
            purchaseParams.reference_type = $selectedOffering.data('reference-type');
          }

          var $buttonsArea = $('.product-offering--actions');

          var btnWaitHtml = '<i class="fas fa-spinner fa-spin"></i> ' + Drupal.t('Please wait…');
          var btnCheckoutHtml = $buttonsArea.find('.button.checkout').html();

          $buttonsArea.find('.button').prop('disabled', true);
          $buttonsArea.find('.button.checkout').html(btnWaitHtml);

          // post to the API
          // upgrade if it's a first time purchase - otherwise use purchase endpoint instead
          if (!this.userHasPaymentProfile()) {
            this.upgrade(purchaseParams);
          } else {
            var purchase = {
              sku: selectedSku,
              reference_id: $selectedOffering.data('reference-id'),
              reference_type: $selectedOffering.data('reference-type'),
              purchase_type: $selectedOffering.data('purchase-type'),
            }

            this.purchase({
              purchases: [purchase]
            }).then(function(response) {
              var url = viewableItem.url ? viewableItem.url : window.location.href;
              $buttonsArea.html('<p><strong>' + Drupal.t('Thank you for your purchase of') + ' <a href="'+url+'">'+ viewableItem.name +'</a>!</strong><br>' + Drupal.t('Loading…') + ' <i class="fas fa-spinner fa-spin"></i></p>');

              if (viewableItem.url) {
                window.location.href = viewableItem.url;
              } else {
                window.location.reload();
              }

              return;
            }).catch(function(error) {
              window.alert(Drupal.t('Purchase was not successful.  Please try again, or contact us for help.'));
              console.error('Purchase failed!', error);

              $buttonsArea.find('.button').prop('disabled', false);
              $buttonsArea.find('.button.checkout').html(btnCheckoutHtml);
            });
          }
        } else if ($t.is('.login')) {
          evt.preventDefault();

          var loginCallback = window.OTTera.refs.modals.form ? window.OTTera.loadLoginForm : this.loadLoginForm.bind(this);
          loginCallback();

          return;
        } else if ($t.is('.skip')) {
          evt.preventDefault();

          window.location.href = viewableItem.url;

          return;
        } else if ($t.is('.terms')) {
          evt.preventDefault();

          ref.find('#ottera-modal-inner').html(termsHtml);

          return;
        } else if ($t.is('.terms--close')) {
          evt.preventDefault();

          ref.find('#ottera-modal-inner').html(productChoicesForm);

          return;
        }
      }.bind(this));

      modalCallback();
    },

    /**
     * Copied from jsLib
     * TODO might be able to remove this if checkout passthrough is in place on
     * API
     *
     * @param params
     * @returns {Promise|*}
     */
    upgrade: function(params) {
      if(undefined === params.products) {
        params.products = 'video';
      }

      if(undefined === window.OTTera.params.auth_token) {
        var auth_token = window.OTTera.getCookie('ottAuthToken');
        if(auth_token && auth_token.length) {
          params.auth_token = auth_token;
        }
        else {
          return alert(Drupal.t("You must be logged in in order to upgrade"));
        }
      }

      // check the page for the regcode field and if a value exists apply it
      var regcode = window.OTTera.getRegcode();
      if (regcode && regcode.length) {
        params.regcode = regcode;

        this.makeRequest('verifyregcode', {
          regcode: regcode
        }).then(function processRegcodeVerify(response) {
          if (response.data) {
            // regcode verification succeeded - go to checkout
            return this.makeRequest('checkout', params);
          } else {
            window.alert('Regcode is not valid. Please check it for typos and try again.');
          }
        }.bind(this), function processRegcodeFailure() {
          // if the endpoint fails for any reason, redirect to checkout
          return this.makeRequest('checkout', params);
        }.bind(this));
      } else {
        // No regcode, no need to call verify, just redirect to checkout
        return this.makeRequest('checkout', params);
      }
    },

    /**
     * For users with payment profiles, make the purchase directly
     *
     * @param params
     * @returns {Promise|*}
     */
    purchase: function(params) {
      if(undefined === window.OTTera.params.auth_token) {
        var auth_token = window.OTTera.getCookie('ottAuthToken');
        if(auth_token && auth_token.length) {
          params.auth_token = auth_token;
        }
        else {
          return alert(Drupal.t("You must be logged in to make a purchase"));
        }
      }

      // redirect the page to checkout
      return this.makeRequest('purchase', params);
    },

    /**
     * Check if the current user has a payment profile available
     * @returns {boolean}
     */
    userHasPaymentProfile: function() {
      var user = window.OTTera.getUser();

      if (!user) return false;

      return (user.has_active_payment_profile === 'true' || user.has_active_payment_profile === true);
    },

    clearFormModal: function() {
      var ref = window.OTTera.refs.modals.form ? window.OTTera.refs.modals.form : this.formModal;

      ref.find('#ottera-modal-inner').html('');

      return true;
    },

    /**
     * Checks if an array contains an object
     *
     * @param array
     * @param objectToCheck
     * @returns {boolean}
     */
    arrayContainsObject : function(array, objectToCheck) {
      var doesContainObject = false;
      if (objectToCheck != null) {
        for (var i = 0; i < array.length; i++) {
          var arrayObject = array[i];
          if (arrayObject == objectToCheck) {
            doesContainObject = true;
            break;
          }
        }
      }
      return doesContainObject;
    },

    /**
     * Are we running at least versionNumber of the OTTera API?
     *
     * @param versionNumber
     * @returns {boolean}
     */
    otteraVersionAtLeast: function(versionNumber) {
      return parseInt(window.OTTera.params.version, 10) >= parseInt(versionNumber, 10);
    },

    /**
     * Returns the HMAC encoded (signed) signature for a query string
     *
     * @param plaintext
     * @param key
     * @returns {*|string|void}
     */
    getHmacSignature: function(plaintext, key) {
      if (plaintext == null || key == null || !CryptoJS) {
        return "";
      }

      plaintext = plaintext.replaceAll(" ", "%20");
      plaintext = plaintext.replaceAll("+", "%2B");
      plaintext = plaintext.replaceAll(",", "%2C");
      var hmac = CryptoJS.HmacSHA256(plaintext, key);
      var base64EncodedHMAC = CryptoJS.enc.Base64.stringify(hmac);
      var percentEscapedHMAC = base64EncodedHMAC.replaceAll("+", "%2B");
      return percentEscapedHMAC;
    },

    /**
     * Returns a query string for a list of parameters, with or without
     * delimiters
     *
     * @param parameters
     * @param includeDelimiters
     * @returns {string}
     */
    stringFromParameters: function(parameters, includeDelimiters) {
      if (parameters == null || Object.keys(parameters).length == 0) {
        return "";
      }
      var parametersString = "";
      var sortedParameterKeys = Object.keys(parameters).sort();
      for (var i = 0; i < sortedParameterKeys.length; i++) {
        var parameter = parameters[sortedParameterKeys[i]];
        if (parameter != null) {
          if (parameter instanceof Array || parameter instanceof Object) {
            parameter = JSON.stringify(parameter);
          }
          parameter = encodeURIComponent(parameter);
          if (includeDelimiters == true) {
            parametersString = parametersString + "&" + sortedParameterKeys[i] + "=" + parameter;
          } else {
            parametersString = parametersString + sortedParameterKeys[i] + parameter;
          }
        }
      }
      return parametersString;
    },

    /**
     * Set COPPA-related behaviors
     *
     * @param {{timeout1: number, timeout2: number}} params
     */
    initCOPPA: function(params) {
      if (!this.settings.coppa || !this.isMainDomain()) return;

      var defaultParams = {timeout1: 500, timeout2: 1000};
      params = params || {};
      params = $.extend({}, defaultParams, params);

      window.setTimeout(function processExternalLinks() {
        // @see jQuery.expr addition above
        $('a:external,a.external-preprocess').each(function(i, el) {
          var $link = $(el);
          $link.addClass('external');

          var extLink = $link.data('external-href');
          if (extLink) $link.attr('href', extLink);

          // this can be blank, but always set it
          var extTitle = $link.data('external-title');
          $link.attr('title', extTitle);
        })
      }.bind(this), params.timeout1);

      window.setTimeout(function setupClickHandling() {
        $(document).on('click.coppa', 'a', function handleExternalClicks(evt) {
          var extlink = $(evt.currentTarget).attr('href');

          if (this.isExternalLink(extlink, evt.currentTarget)) {
            evt.preventDefault();
            this.displayExternalLinkModal(extlink);
          } else {
            return true;
          }

          return false;
        }.bind(this));
      }.bind(this), params.timeout2);
    },

    /**
     * Check if this is an external link, mainly for COPPA compliance
     *
     * @param link
     * @param clicked_obj
     * @returns {boolean}
     */
    isExternalLink: function(link, clicked_obj) {
      // most navlinks should be considered internal
      var navlinkMatches = link.match(/(\w+):\/\//);
      if (navlinkMatches && navlinkMatches.length && navlinkMatches[1]) {
        var linkProtocol = navlinkMatches[1];

        // these are the protocols that might be external links
        if (['web', 'webs', 'http', 'https'].indexOf(linkProtocol) === -1) {
          return false;
        }
      }

      // e.g. ".toongoggles.com"
      var hostCompare = '.' + window.location.hostname.split('.').slice(-2).join('.');

      // e.g. "toongoggles"
      var hostMiddle = window.location.hostname.split('.').slice(-2, 2);

      // links starting with a slash are not external
      if (link.indexOf('/') === 0) return false;

      // hash links are not external
      if (link === '#') return false;

      // check url for external url and enforce COPPA compliance
      if (link.indexOf(hostCompare) === -1) {
        return true;
      }

      // check the nested image url for external images to verify external ad and enforce COPPA compliance
      // (imgs starting with a slash are internal, of course)
      var $nestedImg = $('> img', clicked_obj);
      if ($nestedImg.length) {
        var nestedImgSrc = $nestedImg.attr('src');
        if (nestedImgSrc.indexOf('/') !== 0 && nestedImgSrc.indexOf(hostCompare) === -1) {
          return true;
        }
      }

      // if we made it here all COPPA enforcement has passed and we can follow as a internal link
      return false;
    },

    displayExternalLinkModal: function(url) {
      var ref = window.OTTera.refs.modals.form ? window.OTTera.refs.modals.form : this.formModal;
      var modalCallback = window.OTTera.refs.modals.form ? window.OTTera.openFormModal : this.openFormModal;
      if (!ref) return;

      var countdownValue = 10; // seconds til you're sent along

      var modalContent = '<div id="modal-coppa-compliance"><h3>' + Drupal.t('Leaving') + " " + this.settings.site_name + '</h3><p class="lead">' + Drupal.t('You are about to leave this website.') + '</p><p>' + Drupal.t('If you wish to remain, please click cancel or you will automatically be re-directed in') + ' <span id="ext-counter">'+ countdownValue +'</span> ' + Drupal.t('seconds.') + '</p> <button class="ext-cancel button large">' + Drupal.t('Cancel') + '</button> <button class="ext-continue button primary large">' + Drupal.t('Leave') + '</button></div>';

      ref.find('#ottera-modal-inner').html(modalContent);

      var extIntervalId = null;

      extIntervalId = window.setInterval(function startModalCountdown() {
        countdownValue -= 1;
        jQuery('#modal-coppa-compliance').find('#ext-counter').text(countdownValue);

        if (countdownValue < 1) {
          window.clearInterval(extIntervalId);
          window.location.href = url;
        }
      }, 1000);

      Drupal.behaviors.codesbasePublic.externalLinkCountdownInterval = extIntervalId;

      ref.on('click', function handleCoppaClick(evt) {
        var $t = $(evt.target);
        if ($t.is('.ext-cancel')) {
          evt.preventDefault();
          window.clearInterval(extIntervalId);
          this.closeFormModal();
        } else if ($t.is('.ext-continue')) {
          evt.preventDefault();
          window.location.href = url;
        }
      }.bind(this));

      $(document).on('keyup.coppa', function closeThatModal(evt) {
        if (evt.keyCode === 27) {
          window.clearInterval(extIntervalId);
          $(document).off('keyup.coppa');
        }
      });

      modalCallback();
    },

    /**
     * Converts specially formatted HTML tags into content carousels
     *
     * Expected format:
     * <div class="ottera-items-block" data-ottera-parent-id="1234" data-related-to="4321"
     * data-ottera-parent-type="collection" data-ottera-object-type="show" ottera-display-names="true">
     *
     * OR
     *
     * <div class="ottera-items-block" data-ottera-related-to="4321" data-ottera-object-type="video" ottera-display-names="true">
     *
     * TODO - port as much of this as possible to jsLib
     *
     */
    renderOTTeraItemBlocks: function() {
      var validParentTypes = ['collection', 'category', 'show'];
      var validObjectTypes = [
        'video', 'show', 'collection', 'category', 'audio', 'contributor'
      ];
      var blockClass = '.ottera-items-block';
      var contentRowIdPrefix = 'ottera-items-block--content--';

      $(blockClass).each(function populateItemBlocks(i, el) {
        var $block = $(el);

        var parentId = $block.data('ottera-parent-id');
        var parentType = $block.data('ottera-parent-type');
        var objectType = $block.data('ottera-object-type');
        var videoType = $block.data('ottera-video-type');
        var relatedTo = $block.data('ottera-related-to');
        var displayNames = $block.data('ottera-display-names');
        var categoryId = $block.data('ottera-related-to-category');


        if (!relatedTo) {
          if (!parentId || !parentType || validParentTypes.indexOf(parentType) === -1) {
            console.error('renderOTTeraItemBlocks - block had invalid parent ID or type', parentId, parentType);
            return;
          }
        }

        if (objectType) {
          objectType = objectType.split(',');
          var objectTypes = objectType.map(function(objType) {
            if (validObjectTypes.indexOf(objType) !== -1) {
              return objType;
            }
          });
          objectType = objectTypes.join(',');

          if (!objectType) {
            console.error('renderOTTeraItemBlocks - block had invalid object type', objectType);
            return;
          }
        }

        var row = {
          endpoint: 'getreferencedobjects',
          style: 'table',
          format: 'widescreen',
          parameters: {
            banners: 0,
            for_user: 0,
            image_format: 'widescreen',
            image_width: 480,
            use_device_width_widescreen: 0
          }
        };

        if (parentType) row.parameters.parent_type = parentType;
        if (parentId) row.parameters.parent_id = parentId;
        if (objectType) row.parameters.object_type = objectType;
        if (videoType) row.parameters.video_type = videoType;

        if (relatedTo) {
          row.endpoint = 'getrelatedobjects';
          row.parameters.id = relatedTo;
          row.parameters.object_relation = 'suggested';
          if (categoryId) {
            row.parameters.parent_id = categoryId;
            row.parameters.parent_type = 'category';
          }

          // if requesting related videos, and video_type is not otherwise specified,
          // use "feature" by default
          if (objectType.indexOf('video') !== -1) {
            if (!videoType) {
              row.parameters.video_type = 'feature';
            }
          }
        }

        this.makeRequest(row.endpoint, row.parameters).then(function(response) {
          if (response.objects && response.objects.length) {
            var rowId = contentRowIdPrefix + parentId;

            var rowContext = null;
            if (displayNames === 'true' || displayNames === true) {
              rowContext = {
                extra_display_fields: ['name']
              };
            }
            var markup = this.otteraBuildContentDiv(rowId, response.objects, rowContext);
            $block.html(markup);

            var $row = $('#' + rowId);
            $row.addClass('ottera--row--objects');

            var loadMoreData = {
              endpoint: row.endpoint,
              parameters: row.parameters,
              start: parseInt(response.num_results, 10)
            };

            if (rowContext && rowContext.extra_display_fields) {
              loadMoreData.extra_display_fields = rowContext.extra_display_fields;
            }

            var rowStyle = row.style;
            if (!rowStyle || this.rowStyles.indexOf(rowStyle) === -1) {
              rowStyle = this.rowStyles[0];
            }

            $row.data(this.datakeyLoadMore, loadMoreData)
              .data(this.dataKeyRowStyle, {
                style: rowStyle,
                scale_factor: row.scale_factor ? row.scale_factor : 1
              });

            if (row.style) {
              $row.addClass('ottera-row-style--' + row.style);
            }
            if (row.format) {
              $row.addClass('ottera-row-format--' + row.format);
            }
            if (row.scale_factor) {
              $row.addClass('ottera-row-sf--' + row.scale_factor.replace('.', '_'));
            }

            this.initCarousels({}, rowId);
          } else {
            // if no content is returned, hide the associated header
            $block.siblings('.video--more--title').hide();
          }
        }.bind(this))
      }.bind(this));
    },

    /**
     * A gate for actions that should only take place on the main domain,
     * which is either the channel's main url setting, or www
     * @returns boolean
     */
    isMainDomain: function() {
      if (window.location.hostname.search(/^shop|account/) !== -1) {
        return false;
      } else if (window.location.hostname.search(/^www/) === 0) {
        return true;
      } else {
        if (this.settings.main_url === window.location.href) {
          return true;
        } else {
          // a little extra for local
          return window.location.hostname.search(/^local\.(shop|account)/) === -1;
        }
      }
    },

    /**
     * Fill in video metadata from the API
     */
    videoMetaFallback: function(id) {
      this.getItemDataAndCache(id).then(function (ottObj) {
        // image for player
        if (ottObj.thumbnail_url) {
          $('.video--preview--image').attr('src', ottObj.thumbnail_url);
        }

        // basic metadata
        var $videoMetaGroup = $('.video--meta--grouped');
        if ($videoMetaGroup.length) {
          var metaItems = [];

          if (ottObj.video_type !== 'linear' && ottObj.video_type !== 'live') {
            var duration = this.getDuration(ottObj);
            metaItems.push(duration);
          }

          var countries = ottObj.origin_country && ottObj.origin_country.length
            ? ottObj.origin_country.map(function (c) {
              return c.name;
            }).join(", ")
            : "";
          if (countries) metaItems.push(countries);

          var year = ottObj.year ? ottObj.year : "";
          if (year) metaItems.push(year);

          if (ottObj.content_ratings) {
            var contentRatings = ottObj.content_ratings;

            var ratingsKeys = Object.keys(contentRatings);

            if (ratingsKeys.length === 1) {
              var rating = contentRatings[ratingsKeys[0]].rating.toUpperCase();
              metaItems.push(rating);
            } else {
              // TODO refs #cms-245 - decide on how to display all these ratings
              // For now, just show the first one
              ratingsKeys = ratingsKeys.slice(0, 1);
              var rating = contentRatings[ratingsKeys[0]].rating.toUpperCase();
              metaItems.push(rating);

              /*
              ratingsKeys.forEach(function(rating_key) {
                var rating = rating_key + ": " + contentRatings[rating_key].toUpperCase();
                metaItems.push(rating);
              });
               */
            }
          } else {
            var rating = "";
            if (!rating) rating = ottObj.tv_rating ? ottObj.tv_rating : "";
            if (!rating) rating = ottObj.mpaa_rating ? ottObj.mpaa_rating : "";
            if (!rating) rating = ottObj.bbfc_rating ? ottObj.bbfc_rating : "";

            if (rating) {
              rating = rating.toUpperCase();
              metaItems.push(rating);
            }
          }

          // Only show the language if it's different from the site's default
          var objLang = ottObj.meta && ottObj.meta.language ? ottObj.meta.language : "";
          var objLangCode = ottObj.meta && ottObj.meta.langcode ? ottObj.meta.langcode : "";
          var siteLangCode = this.settings.language ? this.settings.language : "";
          if (objLangCode && objLang && objLangCode !== siteLangCode) metaItems.push(objLang);

          // If we have metadata from the API, update the slot
          if (metaItems.length) {
            var metaString = metaItems.join(" <span class='metadata-group-sep'>/</span> ");

            $videoMetaGroup.html(metaString);
          } else {
            // It's okay for this to be empty
            $videoMetaGroup.html("");
          }
        }
      }.bind(this));

      this.replaceCategoryLabels(id);
    },

    /**
     * Fill in video metadata from the API
     */
    showMetaFallback: function(id) {
      this.replaceCategoryLabels(id);
    },

    /**
     * Replace label using the same dictionary as the apps
     *
     * @param id
     */
    replaceCategoryLabels: function(id) {
      this.getItemDataAndCache(id).then(function (ottObj) {
        // update category labels
        var newLabel;

        var $actorLabel = $('.field--name-field-actors .field__label');
        if ($actorLabel.length) {
          newLabel = window.OTTera.translatePlaceholder('starring');
          if (newLabel) {
            $actorLabel.text(newLabel + ': ');
          }
        }

        var $directorLabel = $('.field--name-field-directors .field__label');
        if ($directorLabel.length) {
          newLabel = window.OTTera.translatePlaceholder('directors');
          if (newLabel) {
            $directorLabel.text(newLabel + ': ');
          }
        }

        var $genreLabel = $('.field--name-field-categories .field__label');
        if ($genreLabel.length) {
          newLabel = window.OTTera.translatePlaceholder('genres');
          if (newLabel) {
            $genreLabel.text(newLabel + ': ');
          }
        }
      }.bind(this));
    },

    /**
     * Get the duration of a video object
     *
     * @param object
     * @returns {string}
     */
    getDuration: function(object) {
      var duration = "0:00";

      if (object != null && object.className === "Video" && object.live === true) {
        return "LIVE";
      }

      if (!object.duration) return duration;

      var seconds = parseInt(object.duration, 10);
      if (seconds > 0) {
        var forHours = Math.floor(seconds / 3600);
        var remainder = Math.floor(seconds % 3600);
        var forMinutes = Math.floor(remainder / 60);
        var forSeconds = Math.floor(remainder % 60);
        if (forMinutes < 10) {
          forMinutes = "0" + forMinutes;
        }
        if (forSeconds < 10) {
          forSeconds = "0" + forSeconds;
        }
        if (forHours !== -1 && forMinutes !== -1 && forSeconds !== -1) {
          duration = (forHours > 0 )?
            forHours + ":" + forMinutes + ":" + forSeconds:
            forMinutes + ":" + forSeconds;
        }
      }
      return duration;
    },

    /**
     * Get debugging params from the URL and set
     */
    setDebugParams: function() {
      var noLinear = this.getUrlParameterByName('no_linear');
      if (noLinear === '1' || noLinear === 'true') {
        this.debug.killLinear = true;
      }
    },

    /**
     * Show the "install the mobile app" if it applies
     */
    initMobileAppInstall: function() {
      var installCookieName = 'mobile-install-seen';

      if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        return;
      }

      // what page(s) should this be displayed on?
      var displayOnThisPage = false;
      if (this.settings.mobile_app_cta && this.settings.mobile_app_cta.pages) {
        // Wildcard == allow everywhere
        if (this.settings.mobile_app_cta.pages.indexOf('*') !== -1) {
          displayOnThisPage = true;
        } else if (this.settings.mobile_app_cta.pages.indexOf(window.location.pathname) !== -1) {
          displayOnThisPage = true;
        }
      } else {
        // absent other settings, only try to display this on the home page
        if ($('body').hasClass('is-front')) {
          displayOnThisPage = true;
        }
      }

      if (!displayOnThisPage) {
        return;
      }

      var iOSLink = this.settings.devices.ios && this.settings.devices.ios.url ? this.settings.devices.ios.url : '';
      var androidLink = this.settings.devices.android && this.settings.devices.android.url ? this.settings.devices.android.url : '';

      if (!iOSLink || !androidLink) {
        var fallbackLinks = this.getFallbackDeviceLinks();
        if (!fallbackLinks.ios || fallbackLinks.android) {
          console.error('Mobile install overlay cannot be shown if there are no mobile app links available!');
          return;
        } else {
          iOSLink = fallbackLinks.ios;
          androidLink = fallbackLinks.android;
        }
      }

      var $overlay = $('.overlay--install');
      if ($overlay.length === 0) return;

      // noinspection EqualityComparisonWithCoercionJS
      if (otteraGetCookie(installCookieName) == 1) {
        return;
      }

      $overlay.show();

      var $button = $overlay.find('.overlay--install--btn .button');
      var $stayLink = $overlay.find('.overlay--install--stay a');

      if (/Android/i.test(navigator.userAgent) && androidLink) {
        $button.attr('href', androidLink);
      } else {
        $button.attr('href', iOSLink);
      }

      $stayLink.click(function(evt) {
        $overlay.fadeOut('fast');
        otteraSetCookie(installCookieName, 1);
      });
    },

    /**
     * If we don't have devices config in the settings, we might still be able
     * to get them from objects on the page
     *
     * @returns {{}}
     */
    getFallbackDeviceLinks: function() {
      var $list = $('.devices-list');
      var links = {};

      var $apple = $list.find('.apple-store a');
      if ($apple.length) {
        links.ios = $apple.attr('href');
      }

      var $google = $list.find('.google-play a');
      if ($google.length) {
        links.android = $google.attr('href');
      }

      return links;
    },

    /**
     * Load basic Kaltura player for fallback when other methods aren't
     * available
     * (e.g. child_only trailer for a video a user doesn't have access to)
     *
     * @param divId
     * @param videoObj
     * @param sourcesConfig
     */
    loadKalturaPlayer: function(divId, videoObj, sourcesConfig) {
      var uiConfId = 44072632;
      var partnerId = 513551;
      var preferredBitRate = 10000;
      sourcesConfig = sourcesConfig || {};

      var kalturaSrc = 'https://cdnapisec.kaltura.com/p/' + partnerId + '/sp/' + partnerId + '00/embedPlaykitJs/uiconf_id/' + uiConfId + '/partner_id/' + partnerId + '/preferredBitrate/' + preferredBitRate;

      var script = document.createElement('script');
      script.onload = initKaltura.bind(this);
      script.src = kalturaSrc;
      document.head.appendChild(script);

      function initKaltura() {
        var playerConfig = {
          targetId: divId,
          logLevel: 'ERROR', //set "DEBUG" for verbose log
          provider: {
            partnerId: partnerId,
            uiConfId: uiConfId
          },
          playback: {
            autoplay: this.settings.options.auto_play.desktop,
            allowMutedAutoPlay: true,
            muted: false,
            playsinline: true
          },
          plugins: {}
        };

        var playerSources = {};

        if (videoObj.thumbnail_url) {
          playerSources.poster = videoObj.thumbnail_url;
        }
        playerSources.hls = [{
          url: videoObj.video_url,
          mimetype: 'application/x-mpegURL'
        }];

        var player = null;
        try {
          player = KalturaPlayer.setup(playerConfig);
        } catch (e) {
          console.error(e.message);
        }
        if (player) {
          // toggle player viewables
          var $playerArea = $('.click-to-play');
          $playerArea.find('.player-container').fadeIn('fast');
          $playerArea.find('.play-icon').hide();

          player.setMedia({
            sources: playerSources
          });

          player.play();
        }
      }
    },

    /**
     * Are we in local dev?
     *
     * @returns {boolean}
     */
    isLocal: function() {
      var server = window.location.origin;
      if (server.indexOf('/local.') > -1) {
        return true;
      } else if (server.indexOf('ddev.site') > -1) {
        return true;
      }

      return false;
    },

    /**
     * Set up any conditional body classes we can
     */
    toggleBodyClasses: function() {
      var $body = $('body');

      if (this.otteraIsLoggedInJS()) {
        if (!$body.hasClass('logged-in')) {
          $body.addClass('logged-in');
        }
        if ($body.hasClass('logged-out')) {
          $body.removeClass('logged-out');
        }
      } else {
        if ($body.hasClass('logged-in')) {
          $body.removeClass('logged-in');
        }
        if (!$body.hasClass('logged-out')) {
          $body.addClass('logged-out');
        }
      }
    },

    /**
     * Helper to iterate over arrays and array-like objects (e.g. NodeLists)
     * without using ugly prototype hacks
     *
     * ref: https://ultimatecourses.com/blog/ditch-the-array-foreach-call-nodelist-hack
     *
     * @param array
     * @param callback
     * @param scope
     * @private
     */
    _forEach: function (array, callback, scope) {
      for (var i = 0; i < array.length; i++) {
        callback.call(scope, i, array[i]);
      }
    }

  };

  /**
   * This object exists just to make UI translation aware of strings to translate
   */
  Drupal.behaviors.translationHelper = {
    attach: function() {
      var translatables = [
        Drupal.t('Or, if you have a registration code, please enter it here'),
        Drupal.t('Enter code'),
        Drupal.t('Apply Registration Code'),
      ]
    }
  }

})(jQuery);
