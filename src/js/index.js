/* jshint esversion: 6 */
/* global $, _*/
(() => {
  'use strict';
  
  $.widget("custom.search", {
    
    options: {
      searchResultsPerPage: 50
    },
    
    _create : function() {
      this.shuffle = new Shuffle($('.search-results-box .list-group')[0], {
        itemSelector: '.search-result-item',
        sizer: $('.suffle-sizer')[0],
        useTransforms: true,
        speed: 800
      });

      this.element.on("keyup", '.freetext-search', $.proxy(this._onFreeTextSearchKeyUp, this));
    },
    
    _onFreeTextSearchKeyUp: function (event) {
      const value = $(event.target).val();
      

      $.post('/ajax/search', { freeText: value, from: 0, size: this.options.searchResultsPerPage }, (response) => {
        const searchResultsContainer = $('.search-results-box ul.list-group'); 
        const addElements = [];
        const existingIds = searchResultsContainer.find('.list-group-item.search-result-item').map((index, item) => {
          return $(item).attr('data-id');
        }).get();
        
        _.forEach(response.hits, (hit) => {
          const existing = searchResultsContainer.find(`[data-id="${hit._id}"]`);
          const resultHtml = pugSearchResultItem({
            hit: hit._source,
            score: hit._score,
            id: hit._id
          });
          
          _.pull(existingIds, hit._id);
          
          if (existing.length) {
            existing.attr('data-score', hit._score);
          } else {
            const addElement = $(resultHtml);          
            addElements.push(addElement[0]);
            addElement.appendTo(searchResultsContainer);
          }
        });
        
        this.shuffle.add(addElements);
        this.shuffle.remove(_.map(existingIds, (existingId) => {
          const item = searchResultsContainer.find(`.list-group-item.search-result-item[data-id="${existingId}"]`);
          item.removeAttr('data-id');
          return item[0];
        }));
        this.shuffle.sort({
          by: (element) => {
            return parseFloat($(element).attr('data-score'));
          }
        });

      });
    }
  
  });
  
  $(document).ready(() => {
    $(document).search();
  });
  
})();