/* jshint esversion: 6 */
/* global $, _, tinycolor, L, moment*/
(() => {
  'use strict';

  $(document).ready(() => {

    $(window).scroll(() => {
       if ($(window).scrollTop() > 0) {
         $('.scroll-up-btn').fadeIn();
       } else {
         $('.scroll-up-btn').fadeOut();
       }
    });
    
    $('.scroll-up-btn').click(() => {
      $("html, body").animate({ scrollTop: 0 }, 'slow');
    });
    
  });
  
})();