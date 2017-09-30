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
      
      this.shuffle = new Shuffle($('.search-results-box .list-group')[0], {
        itemSelector: '.search-result-item',
        sizer: $('.suffle-sizer')[0],
        useTransforms: true,
        speed: 800
      });
      
      this.element.on("keyup", '.freetext-search', $.proxy(this._onFreeTextSearchKeyUp, this));
      this.element.on("change", '.filter input[type="checkbox"]', $.proxy(this._onToggleFilterChange, this));
      this.element.on("click", '.search-result-item-title-container', $.proxy(this._onSearchResultItemTitleContainerClick, this));
      this.element.on("click", '.search-result-icon-container', $.proxy(this._onSearchResultItemIconContainerClick, this));
      this.element.on("click", '.search-tree-item', $.proxy(this._onSearchTreeItemClick, this));
      this.element.on("click", '.search-container-title', $.proxy(this._onSearchContainerTitleClick, this));
      
      this._createLocationFilterMap(this.element.find('.location-filter'));
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition($.proxy(this._onCurrentGeoLocationPosition, this));
      }
      
      this._loadSearchTreeLevel(0);
      this._updateToggleFilters();
      this._initializeDateRangeFilter();
      this._doSearch();
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
        mode: "range",
        inline: true,
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
        
      this._searchMap.addControl(drawControl);
      this._searchMap.on(L.Draw.Event.CREATED, $.proxy(this._onSearchMapDrawEventCreated, this));
      this._searchMap.on(L.Draw.Event.EDITED, $.proxy(this._onSearchMapDrawEventEdited, this));
    },
    
    _updateToggleFilters: function () {
      if ($('.filter input[type="checkbox"]:checked').length === 0) {
        $('.filter input[type="checkbox"]').prop('checked', true);
      }
      
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
    
    _doSearch: function () {
      $('.no-results-container').hide();
      
      const freeText = $('.freetext-search').val();
      const apiIds = $('.api-filter input:checked').map((index, input) => {
        return $(input).val();
      }).get();
      
      if (!apiIds.length) {
        $('.search-results-box ul.list-group').empty();
        return;
      }
      
      const treeEnabled = !$('.search-tree-container').hasClass('container-closed');
      const filtersEnabled = !$('.filter-container').hasClass('container-closed');
      
      const options = {
        apiIds: filtersEnabled ? apiIds : null,
        freeText: freeText, 
        geoJson: filtersEnabled ? this._geoJsonQuery ? JSON.stringify(this._geoJsonQuery.geometry) : null : null,
        functionId: treeEnabled ? this._functionId : null,
        from: 0, 
        size: this.options.searchResultsPerPage,
        eventWithinStart: this._eventWithinFilter ? this._eventWithinFilter[0] : null,
        eventWithinEnd: this._eventWithinFilter ? this._eventWithinFilter[1] : null
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
          const rootFunctionId = source.functionId ? source.functionId.split(' ')[0] : '99';
          
          const resultHtml = pugSearchResultItem({
            title: _.truncate(source.resultText, { length: 100 }),
            hit: source,
            score: hit._score,
            id: hit._id,
            sourceApi: this._getApiName(source.apiId),
            rootFunctionId: rootFunctionId,
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

        if (!response.hits.length) {
          $('.no-results-container').show();
        }
        
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
      this.shuffle.layout();
      
      if (item.hasClass('search-result-item-open')) {
        item.addClass('search-result-item-loading');
        
        const caseGeometriesStr = item.attr('data-case-geometries');
        const caseGeometries = caseGeometriesStr ? JSON.parse(caseGeometriesStr) : null;
        
        $.getJSON(`/ajax/action/${apiId}/${actionId}`, (response) => {
          const html = pugSearchResultItemOpen({
            sourceApi: item.attr('data-source-api'),
            functionId: item.attr('data-function-id'),
            registerId: item.attr('data-register-id'),
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
          } else {
            item.find('.map').hide();
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
    },
    
    _onDateRangeFilterChange: function (selectedDates, dateStr, instance) {
      if (selectedDates.length === 2) {
        const start = moment(selectedDates[0]).hour(0).minute(0);
        const end = moment(selectedDates[1]).hour(23).minute(59);
        this._eventWithinFilter = [start.format(), end.format()];
      } else {
        this._eventWithinFilter = null;
      }
      
      this._doSearch();
    },
    
    _onSearchMapDrawEventCreated: function (event) {
      this._searchMapEditableLayers.clearLayers();
      const layer = event.layer;
      this._searchMapEditableLayers.addLayer(layer);
      this._geoJsonQuery = layer.toGeoJSON();
      this._doSearch();
    },
    
    _onSearchMapDrawEventEdited: function (event) {
      const layers = this._searchMapEditableLayers.getLayers();
      const layer = layers[0];
      this._geoJsonQuery = layer.toGeoJSON();
      this._doSearch();
    },
    
    _onCurrentGeoLocationPosition: function (position) {
      this._searchMap.panTo(new L.LatLng( position.coords.latitude, position.coords.longitude));
    },
    
    _onToggleFilterChange: function () {
      this._updateToggleFilters();
      this._doSearch();
    },
    
    _onFreeTextSearchKeyUp: function (event) {
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
      
      this._doSearch();
    },
    
    _onSearchContainerTitleClick: function (event) {
      $(event.target).closest('.search-container').toggleClass('search-container-closed');
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