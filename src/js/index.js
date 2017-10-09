/* jshint esversion: 6 */
/* global $, _, tinycolor, L, moment*/
(() => {
  'use strict';
  
  $.widget("custom.search", {
    
    options: {
      searchResultsPerPage: 20,
      leaflet: {
        tiles: {
          urlTemplate: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
          options: {
            attribution: "" /*[
              'Map tiles by <a href="http://stamen.com/">Stamen Design</a>, ',
              'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
              'Data by <a href="http://openstreetmap.org/">OpenStreetMap</a>, ',
              'under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
            ].join("")*/
          }
        },
        searchOptions: {
          center: new L.LatLng(60.192059, 24.945831),
          zoom: 12,
          maxZoom: 18
        }
      }
    },
    
    _create : function() {
      this._geoJsonQuery = null;
      this._enabledApis = _.keyBy(JSON.parse($('input[name="enabled-apis"]').val()), "id");
      this._allApisEnabled = false;
      this._eventWithinStart = null;
      this._eventWithinEnd = null;
      this._offset = 0;
      this._total = 0;
      this._loadingMore = false;
      
      this._isotope = $('.search-result-rows-container').isotope({
        itemSelector: '.search-result-item',
        layoutMode: 'vertical',
         getSortData: {
          score: '[data-score] parseFloat',
          date: '[data-date] parseInt',
        },
        sortBy: [ 'score', 'date' ],
        sortAscending: {
          score: false,
          date: false
        }
      });

      this.element.on("keyup", '.freetext-search', $.proxy(this._onFreeTextSearchKeyUp, this));
      this.element.on("change", '.filter input[type="checkbox"]', $.proxy(this._onToggleFilterChange, this));
      this.element.on("click", '.search-result-item-title-container', $.proxy(this._onSearchResultItemTitleContainerClick, this));
      this.element.on("click", '.search-result-icon-container', $.proxy(this._onSearchResultItemIconContainerClick, this));
      this.element.on("click", '.search-tree-item', $.proxy(this._onSearchTreeItemClick, this));
      this.element.on("click", '.search-container-title', $.proxy(this._onSearchContainerTitleClick, this));
      this.element.on("click", '.remove-filter', $.proxy(this._onRemoveFilterClick, this));
      this.element.on("click", '.save-search-btn', $.proxy(this._saveSearch, this));
      this.element.on("click", '.copy-to-clipboard-btn', $.proxy(this._copyToClipboard, this));
      this.element.on("click", '.get-rss-btn', $.proxy(this._createRssFeed, this));
      this.element.on("click", '.locate-address-btn', $.proxy(this._geocodeAddress, this));
      this.element.on("click", '.empty-date-filter-btn', $.proxy(this._onEmptyDateFilterClick, this));
      this.element.on("click", '.remove-map-filter-btn', $.proxy(this._onRemoveMapFilterClick, this));
      
      $(window).scroll($.proxy(this._onWindowScroll, this));
      
      this._createLocationFilterMap(this.element.find('.location-filter'));
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition($.proxy(this._onCurrentGeoLocationPosition, this));
      }
      
      this._loadSearchTreeLevel(0);
      this._initializeDateRangeFilter();
      this._processSavedSearch();
      this._updateToggleFilters();
      this._doSearch();
    },
    
    _onRemoveMapFilterClick: function(e) {
      this._searchMapEditableLayers.clearLayers();
      this._geoJsonQuery = null;
      this._doSearch();
    },
    
    _onEmptyDateFilterClick: function(e) {
      $(e.target).parents('.input-group').find('.date-range-filter')[0]._flatpickr.clear();
    },
    
    _geocodeAddress: function(e) {
      const gecodeBtn = $(e.target).closest('.locate-address-btn');
      
      gecodeBtn
        .find('.fa')
        .removeClass('fa-caret-right')
        .addClass('fa-spinner fa-spin');
      
      const location = $(this.element).find('.geocoder-input').val();
      if (!location) {
        return;
      }
      
      $.getJSON(`/ajax/gecode?location=${location}`, (coordinates) => {
        $(this.element).find('.geocoder-input').val('');
        this._searchMap.panTo(coordinates);
        gecodeBtn
          .find('.fa')
          .removeClass('fa-spinner fa-spin')
          .addClass('fa-caret-right');
      });
      
    },
    
    _onWindowScroll: function() {
      
      if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
        if (!this._loadingMore && this._total > 0 && this._offset < this._total) {
          this._loadingMore = true;
          this._offset += this.options.searchResultsPerPage;
          this._doSearch(true);
        }
      }
    },
    
    _processSavedSearch: function() {
      if (!$('.saved-search').val()) {
        return;
      }
      
      const savedSearch = JSON.parse($('.saved-search').val());
      if (savedSearch.body) {
        const searchquery = savedSearch.body.query.bool;
        
        if (searchquery.filter && searchquery.filter['geo_shape'] && searchquery.filter['geo_shape'].caseGeometries) {
          const filterLayer = L.geoJSON(searchquery.filter['geo_shape'].caseGeometries.shape);
          this._searchMapEditableLayers.addLayer(filterLayer);
          this._geoJsonQuery = filterLayer.toGeoJSON().features[0];
          this._searchMap.fitBounds(filterLayer.getBounds().pad(0.1), { maxZoom: 14 });
        }
        if (searchquery.must) {
          let searchFilters = {};
          for (let i = 0; i < searchquery.must.length; i++) {
            searchFilters = _.merge(searchFilters, searchquery.must[i]);
          }
          if (searchFilters.terms) {
            const apiFilters = searchFilters.terms.apiId;
            for (let i = 0; i < apiFilters.length; i++) {
              $(`.filter input[type="checkbox"][value="${apiFilters[i]}"]`).prop('checked', true);
            }
          }
          if (searchFilters.match) {
            $('.freetext-search').val(searchFilters.match.contentTexts);
          }
          if (searchFilters.range) {
            const rangeFilters = searchFilters.range;
            if (rangeFilters.eventStart) {
              this._eventWithinEnd = moment(rangeFilters.eventStart.lte);
              $('.date-range-filter.filter-end')[0]._flatpickr.setDate(this._eventWithinEnd.toDate(), false);
            }

            if (rangeFilters.eventEnd) {
              this._eventWithinStart = moment(rangeFilters.eventEnd.gte);
              $('.date-range-filter.filter-start')[0]._flatpickr.setDate(this._eventWithinStart.toDate(), false);
            }
          }
          if (searchFilters.prefix) {
            $('.search-tree-container').removeClass('search-container-closed');
            const treeIds = searchFilters.prefix.functionId.split(' ');
            let currentId = treeIds[0];
            for(let i = 1; i < treeIds.length; i++) {
              this._loadSearchTreeLevel(i, currentId);
              currentId += ` ${treeIds[i]}`;
            }
            $(`.search-tree-item[data-id="${searchFilters.prefix.functionId}"]`).click();
          }
        }
      }
      
    },
    
    _getApiName: function (apiId) {
      return (this._enabledApis[apiId]||{}).name || 'Tuntematon';
    },
    
    _loadSearchTreeLevel: function (level, parentId) {
      const treeNodes = this._findSearchTreeNodes(parentId); 
      const ids = Object.keys(treeNodes);
      ids.sort();
      
      for (let l = level; l < 3; l++) {
        $(`.search-tree-level-${l + 1}`).empty();
      }
      
      _.forEach(ids, (id) => {
        const treeNode = treeNodes[id];
        const rootId = treeNode.id.split(' ')[0];

        $(pugSearchTreeItem({
          node: treeNode, 
          rootId: rootId,
          active: level > 0
        })).appendTo($(`.search-tree-level-${level + 1}`));
      });
    },
    
    _findSearchTreeNodes: function (parentId) {
      const functionIds = getPaatosFunctionIds();
      if (!parentId) {
        return functionIds;
      }
      
      const parentTree = parentId.split(' ');
      let result = functionIds[parentTree[0]];
      
      for (let i = 1; i < parentTree.length; i++) {
        result = result.children[parentTree[i]];
      }
      
      return result.children;
    },
    
    _initializeDateRangeFilter: function () {
      flatpickr(".date-range-filter", {
        dateFormat: 'd.m.Y',
        onChange: $.proxy(this._onDateRangeFilterChange, this)
      });
    },
    
    _createLocationFilterMap: function(mapElement) {
      this._searchMap = new L.Map(mapElement[0], this.options.leaflet.searchOptions);
      L.tileLayer(this.options.leaflet.tiles.urlTemplate, this.options.leaflet.tiles.options).addTo(this._searchMap);
      this._searchMapEditableLayers = new L.FeatureGroup();
      this._searchMap.addLayer(this._searchMapEditableLayers);
      
      const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
          polygon: {
            allowIntersection: false, 
            shapeOptions: {
              clickable: false
            }
          },
          polyline : false,
          rectangle: {
            shapeOptions: {
              clickable: false
            }
          },
          circle : false,
          marker: false,
          circlemarker: false
        },
        edit: {
          featureGroup: this._searchMapEditableLayers,
          remove: false
        }
      });
      
      const RemoveFilterControl = L.Control.extend({
        options: {
          position: 'topleft' 
        },
        onAdd: function (map) {
          const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom remove-map-filter-btn');
          $(container).append($('<i>').addClass('fa fa-times'));
          return container;
        },

      })
      
      this._searchMap.addControl(new RemoveFilterControl());
      this._searchMap.addControl(drawControl);
      this._searchMap.on(L.Draw.Event.CREATED, $.proxy(this._onSearchMapDrawEventCreated, this));
      this._searchMap.on(L.Draw.Event.EDITED, $.proxy(this._onSearchMapDrawEventEdited, this));
    },
    
    _updateToggleFilters: function (e) {
      if (this._allApisEnabled) {
        this._allApisEnabled = false;
        $('.filter input[type="checkbox"]').prop('checked', false);
        $(e.target).prop('checked', true);
      }
      
      if ($('.filter input[type="checkbox"]:checked').length === 0) {
        $('.filter input[type="checkbox"]').prop('checked', true);
      } 
      
      if ($('.filter input[type="checkbox"]:not(:checked)').length === 0) {
        this._allApisEnabled = true;
      }
      
      this._updateApiFilterIcons();
    },
    
    _updateApiFilterIcons: function() {
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
    
    _parseSearch: function() {
      const freeText = $('.freetext-search').val();
      const apiIds = $('.api-filter input:checked').map((index, input) => {
        return $(input).val();
      }).get();

      const treeEnabled = !$('.search-tree-container').hasClass('search-container-closed');
      const filtersEnabled = !$('.filter-container').hasClass('search-container-closed');
      
      return {
        apiIds: filtersEnabled ? apiIds : null,
        freeText: freeText, 
        geoJson: filtersEnabled ? this._geoJsonQuery ? JSON.stringify(this._geoJsonQuery.geometry) : null : null,
        functionId: treeEnabled ? this._functionId : null,
        from: this._offset, 
        size: this.options.searchResultsPerPage,
        eventWithinStart: filtersEnabled && this._eventWithinStart ? this._eventWithinStart.format() : null,
        eventWithinEnd: filtersEnabled && this._eventWithinEnd ? this._eventWithinEnd.format() : null
      };
    },

    _createRssFeed: function() {
      const options = this._parseSearch();
      $.post('/ajax/search/save', options, (response) => {
         const rssUrl = `${location.protocol}//${location.host}${location.pathname}rss/${encodeURIComponent(response.id)}`;
         $('.rss-link-container').attr('href', rssUrl).text(rssUrl).show();
      });
    },

    _saveSearch: function() {
      const options = this._parseSearch();
      $.post('/ajax/search/save', options, (response) => {
        $('.search-url-container').val(`${location.protocol}//${location.host}${location.pathname}?search=${encodeURIComponent(response.id)}`);
        $('.search-url-container,.copy-to-clipboard-btn').show();
      });
    },
    
    _copyToClipboard: function(e) {
      if(!$('.search-url-container').val()) {
        return;
      }

      const options = this._parseSearch();
      $('.search-url-container').select();
      document.execCommand("copy");
      $(e.target).tooltip({title: "Copied to clipboard!"});
      $(e.target).tooltip('show');
      setTimeout(() => {
        $(e.target).tooltip('dispose');
      }, 3000);
    },
    
    _doSearch: function (append) {
      $('.no-results-container').hide();
      $('.search-url-container,.copy-to-clipboard-btn').hide();
      
      const options = this._parseSearch();
      this._updateActiveFilters(options);
      const searchResultsContainer = $('.search-result-rows-container');
      searchResultsContainer.append($('<div>').addClass('loader'));
      $.post('/ajax/search', options, (response) => {
        this._total = response.total;
        
        const addElements = [];
        const existingIds = searchResultsContainer.find('.list-group-item.search-result-item').map((index, item) => {
          return $(item).attr('data-id');
        }).get();
        
        _.forEach(response.hits, (hit) => {
          const existing = searchResultsContainer.find(`[data-id="${hit._id}"]`);
          const source = hit._source;
          const rootFunctionId = source.functionId ? source.functionId.split(' ')[0] : '99';
          
          const resultHtml = pugSearchResultItem({
            title: _.truncate(source.resultText, { length: 90 }),
            hit: source,
            score: hit._score,
            id: hit._id,
            sourceApi: this._getApiName(source.apiId),
            rootFunctionId: rootFunctionId,
            caseGeometries: source.caseGeometries && source.caseGeometries.geometries ? source.caseGeometries.geometries : null,
            date: source.eventStart ? moment(source.eventStart).format('D.M.YYYY') : null,
            dateMillis: source.eventStart ? moment(source.eventStart).valueOf() : 0
          });
        
          _.pull(existingIds, hit._id);
          
          if (existing.length) {
            existing.attr('data-score', hit._score);
            this._isotope.isotope( 'updateSortData', existing )
          } else {    
            addElements.push($(resultHtml));
          }

        });

        $('.loader').remove();

        if (!append) {
          $('.rss-link-container').hide();
          
          this._isotope.isotope( 'insert', _.map(addElements, (elementToAdd) => { return elementToAdd[0]; }));

          const itemsToRemove = _.map(existingIds, (existingId) => {
            const item = searchResultsContainer.find(`.list-group-item.search-result-item[data-id="${existingId}"]`);
            item.removeAttr('data-id');
            return item[0];
          });

          this._isotope.isotope('remove', itemsToRemove).isotope('layout');
        } else {
          _.forEach(addElements, (elementToAdd) => {this._isotope.append( elementToAdd ).isotope('appended', elementToAdd ); })
        }

        if (!response.hits.length && $('.search-result-item[data-id]').length === 0) {
          searchResultsContainer.empty();
          $('.no-results-container').show();
        }
        
        this._isotope.isotope('layout');
        this._loadingMore = false;
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
    
    _toggleSearchResultItemOpen: function (item) {
      item.toggleClass('search-result-item-open');
      const apiId = $(item).attr('data-api-id');
      const actionId = $(item).attr('data-action-id');
      this._isotope.isotope('layout');

      if (item.hasClass('search-result-item-open')) {
        item.addClass('search-result-item-loading');
        this._isotope.isotope('layout');

        const caseGeometriesStr = item.attr('data-case-geometries');
        const caseGeometries = caseGeometriesStr ? JSON.parse(caseGeometriesStr) : null;
        
        $.getJSON(`/ajax/action/${apiId}/${actionId}`, (response) => {
          const html = pugSearchResultItemOpen({
            sourceApi: item.attr('data-source-api'),
            functionId: item.attr('data-function-id'),
            registerId: item.attr('data-register-id'),
            apiId: apiId,
            actionId: actionId,
            title: response.title,
            contents: response.contents.sort((a, b) => {
              return a.ordering - b.ordering;
            })
          });
          
          item.find('.search-result-details').html(html);
          
          item.removeClass('search-result-item-loading');
          this._isotope.isotope('layout');

          if (caseGeometries && caseGeometries.length) {
            const mapElement = item.find('.map');
            const map = new L.Map(mapElement[0]);
            L.tileLayer(this.options.leaflet.tiles.urlTemplate, this.options.leaflet.tiles.options).addTo(map);
            const layer = L.geoJSON(caseGeometries);
            layer.addTo(map);
            map.fitBounds(layer.getBounds().pad(0.1), { maxZoom: 10 });
            mapElement.data('map', map);
          } else {
            item.find('.map').hide();
          }

        });
      } else {
        const map = item.find('.map').data('map');
        if (map) {
          map.remove();
        }
      }
    },

    _updateActiveFilters: function(searchOptions) {
      const filterContainer = $('.active-filters');
      filterContainer.empty();
      if (searchOptions.freeText) {
        filterContainer.append(pugActiveFilterItem({
          filter: 'freetext',
          text: `Hakusanalla: ${searchOptions.freeText}`
        }));        
      }
      
      if ($('.filter input[type="checkbox"]:not(:checked)').length > 0 && searchOptions.apiIds) {
        const activeApiNames = _.map(searchOptions.apiIds, (apiId) => {
          return this._getApiName(apiId);
        });
        
        filterContainer.append(pugActiveFilterItem({
          filter: 'apiids',
          text: `Vain rajapinnoista: ${activeApiNames.join(',')}`
        }));      
      }

      if (searchOptions.eventWithinStart || searchOptions.eventWithinEnd) {
        let filterText = '';
        if (!searchOptions.eventWithinStart ) {
          filterText = `${moment(searchOptions.eventWithinEnd).format('D.M.YYYY')} asti`;
        } else if (!searchOptions.eventWithinEnd) {
          filterText = `alkaen ${moment(searchOptions.eventWithinStart).format('D.M.YYYY')}`;
        } else {
          filterText = `${moment(searchOptions.eventWithinStart).format('D.M.YYYY')} - ${moment(searchOptions.eventWithinEnd).format('D.M.YYYY')}`
        }
        
        filterContainer.append(pugActiveFilterItem({
          filter: 'date',
          text: filterText
        }));
      }

      if (searchOptions.geoJson) {
        filterContainer.append(pugActiveFilterItem({
          filter: 'geo',
          text: 'aluerajaus'
        }));
      }
      
      if (searchOptions.functionId) {
        filterContainer.append(pugActiveFilterItem({
          filter: 'functionid',
          text: $(`.search-tree-item[data-id="${searchOptions.functionId}"]`).attr('title')
        }));  
      }
      
      if ($('.active-filter-indicator').length === 0) {
        $('.active-filters-text').text('');
      } else {
        $('.active-filters-text').text('Suotimet:');
      }
      
    },

    _onRemoveFilterClick: function(e) {
      const filterElement = $(e.target).closest('.active-filter-indicator');
      const filterType = filterElement.attr('data-filter');

      switch (filterType) {
        case 'freetext':
          $('.freetext-search').val('');
        break;
        case 'apiids':
          $('.filter input[type="checkbox"]').prop('checked', true);
          this._allApisEnabled = true;
          this._updateApiFilterIcons();
        break;
        case 'date':
          this._eventWithinStart = null;
          this._eventWithinEnd = null;
          $('.date-range-filter.filter-start').val('');
          $('.date-range-filter.filter-end').val('');
        break;
        case 'geo':
          this._searchMapEditableLayers.clearLayers();
          this._geoJsonQuery = null;
        break;
        case 'functionid':
          this._loadSearchTreeLevel(0);
          this._functionId = null;
        break;
      }
      
      filterElement.remove();
      this._offset = 0;
      this._doSearch();
    },

    _onDateRangeFilterChange: function (selectedDates, dateStr, instance) {
      const isStartFilter = $(instance.element).hasClass('filter-start');
      const startDateString = $('.date-range-filter.filter-start').val();
      const endDateString = $('.date-range-filter.filter-end').val();

      if (startDateString) {
        this._eventWithinStart = moment(startDateString, 'DD.MM.YYYY').startOf('day');
      } else {
        this._eventWithinStart = null;
      }

      if (endDateString) {
        this._eventWithinEnd = moment(endDateString, 'DD.MM.YYYY').endOf('day');
      } else {
        this._eventWithinEnd = null;
      }
      
      this._offset = 0;
      this._doSearch();
    },
    
    _onSearchMapDrawEventCreated: function (event) {
      this._searchMapEditableLayers.clearLayers();
      const layer = event.layer;
      this._searchMapEditableLayers.addLayer(layer);
      this._geoJsonQuery = layer.toGeoJSON();
      this._offset = 0;
      this._doSearch();
    },
    
    _onSearchMapDrawEventEdited: function (event) {
      const layers = this._searchMapEditableLayers.getLayers();
      const layer = layers[0];
      this._geoJsonQuery = layer.toGeoJSON();
      this._offset = 0;
      this._doSearch();
    },
    
    _onCurrentGeoLocationPosition: function (position) {
      this._searchMap.panTo(new L.LatLng( position.coords.latitude, position.coords.longitude));
    },
    
    _onToggleFilterChange: function (e) {
      this._updateToggleFilters(e);
      this._offset = 0;
      this._doSearch();
    },
    
    _onFreeTextSearchKeyUp: function (event) {
      this._offset = 0;
      this._doSearch();
    },
    
    _onSearchTreeItemClick: function (event) {
      const item = $(event.target).closest('.search-tree-item');
      const tree = item.closest('.search-tree-box');
      const parentId = item.attr('data-id');
      const parentLevel = parseInt(item.attr('data-level'));
      
      if (parentLevel === 0 && item.hasClass('active')) {        
        this._loadSearchTreeLevel(0);
        this._functionId = null;
      } else {
        tree.find('.search-tree-item').removeClass('active');
        item.addClass('active');

        if (parentLevel < 2) {
          this._loadSearchTreeLevel(parentLevel + 1, parentId);
        }

        this._functionId = item.attr('data-id');
      }
      
      this._offset = 0;
      this._doSearch();
    },
    
    _onSearchContainerTitleClick: function (event) {
      $(event.target).closest('.search-container').toggleClass('search-container-closed');
      this._offset = 0;
      this._doSearch();
    },
    
    _onSearchResultItemIconContainerClick: function () {
      this._toggleSearchResultItemOpen($(event.target).closest('.search-result-item'));
    },
    
    _onSearchResultItemTitleContainerClick: function (event) {
      this._toggleSearchResultItemOpen($(event.target).closest('.search-result-item'));
    }
  
  });
  
  $(document).ready(() => {
    $(document).search();
  });
  
})();