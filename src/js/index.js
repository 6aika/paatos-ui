/* jshint esversion: 6 */
/* global $, _, tinycolor, L*/
(() => {
  'use strict';
  
  $.widget("custom.search", {
    
    options: {
      searchResultsPerPage: 50,
      leaflet: {
        tiles: {
          urlTemplate: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
          options: {
            attribution: [
              'Map tiles by <a href="http://stamen.com/">Stamen Design</a>, ',
              'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
              'Data by <a href="http://openstreetmap.org/">OpenStreetMap</a>, ',
              'under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
            ].join("")
          }
        }
      }
    },
    
    _create : function() {
      this.shuffle = new Shuffle($('.search-results-box .list-group')[0], {
        itemSelector: '.search-result-item',
        sizer: $('.suffle-sizer')[0],
        useTransforms: true,
        speed: 800
      });
      
      this.element.on("keyup", '.freetext-search', $.proxy(this._onFreeTextSearchKeyUp, this));
      this.element.on("change", '.filter input[type="checkbox"]', $.proxy(this._onToggleFilterChange, this));
      this.element.on("click", '.search-result-item', $.proxy(this._onSearchResultItemClick, this));
      
      this._updateToggleFilters();
      this._doSearch();
    },
    
    _updateToggleFilters: function () {
      $('.filter input[type="checkbox"]').each((index, element) => {
        const input = $(element);
        const filter = input.closest('.filter');
        if (input.is(':checked')) {
          filter.addClass('filter-enabled');
        } else {
          filter.removeClass('filter-enabled');
        }
      });
    },
    
    _getActionFunctionClass: function () {
      return Math.random() > 0.5 ? 'environment-action' : 'city-action';
    },
    
    _doSearch: function () {
      const freeText = $('.freetext-search').val();
      const apiIds = $('.api-filter input:checked').map((index, input) => {
        return $(input).val();
      }).get();
      
      if (!apiIds.length) {
        $('.search-results-box ul.list-group').empty();
        return;
      }
      
      const options = {
        apiIds: apiIds,
        freeText: freeText, 
        from: 0, 
        size: this.options.searchResultsPerPage
      };
      
      $.post('/ajax/search', options, (response) => {
        const searchResultsContainer = $('.search-results-box ul.list-group'); 
        const addElements = [];
        const existingIds = searchResultsContainer.find('.list-group-item.search-result-item').map((index, item) => {
          return $(item).attr('data-id');
        }).get();
        
        _.forEach(response.hits, (hit) => {
          const existing = searchResultsContainer.find(`[data-id="${hit._id}"]`);
          const source = hit._source;
          const resultHtml = pugSearchResultItem({
            title: source.resultText,
            hit: source,
            score: hit._score,
            id: hit._id,
            functionClass: this._getActionFunctionClass(),
            caseGeometries: source.caseGeometries && source.caseGeometries.geometries ? source.caseGeometries.geometries : null
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
    },
    
    _wrapGeoJSONFeature: function (geometry) {
      return {
        type: 'Feature',
        properties: {},
        geometry: geometry
      };
    },
    
    _wrapGeoJSONFeatures: function (geometries) {
      return _.map(geometries, (geometry) => {
        return this._wrapGeoJSONFeature(geometry);
      });
    },
    
    _onToggleFilterChange: function () {
      this._updateToggleFilters();
      this._doSearch();
    },
    
    _onFreeTextSearchKeyUp: function (event) {
      this._doSearch();
    },
    
    _onSearchResultItemClick: function (event) {
      if ($(event.target).closest('.map').length) {
        return;
      }
      
      const item = $(event.target).closest('.search-result-item');
      item.toggleClass('search-result-item-open');
      
      const apiId = $(item).attr('data-api-id');
      const actionId = $(item).attr('data-action-id');
      this.shuffle.layout();
      
      if (item.hasClass('search-result-item-open')) {
        item.addClass('search-result-item-loading');
        
        const caseGeometriesStr = item.attr('data-case-geometries');
        const caseGeometries = caseGeometriesStr ? JSON.parse(caseGeometriesStr) : null;
        
        $.getJSON(`/ajax/action/${apiId}/${actionId}`, (response) => {
          const html = pugSearchResultItemOpen({
            title: response.title,
            contents: response.contents.sort((a, b) => {
              return a.ordering - b.ordering;
            })
          });
          
          item.find('.search-result-details').html(html);
          
          if (caseGeometries && caseGeometries.length) {
            const mapElement = item.find('.map');
            const map = new L.Map(mapElement[0]);
            L.tileLayer(this.options.leaflet.tiles.urlTemplate, this.options.leaflet.tiles.options).addTo(map);
            const layer = L.geoJSON(caseGeometries);
            layer.addTo(map);
            map.fitBounds(layer.getBounds().pad(0.1), { maxZoom: 10 });
            mapElement.data('map', map);
          }
        
          item.removeClass('search-result-item-loading');
          this.shuffle.layout();
        });
      } else {
        const map = item.find('.map').data('map');
        if (map) {
          map.remove();
        }
      }
    }
  
  });
  
  $(document).ready(() => {
    $(document).search();
  });
  
})();