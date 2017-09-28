/* jshint esversion: 6 */
/* global __dirname */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const GeoJsonBasicUtils = require('geojson-basic-utils');
  
  class ApiUtils {
    
    /**
     * Extracts url ids from resource collection
     * 
     * @param {array} collection
     * @param {string} property
     * @returns {array} array of ids
     */
    static extractUrlResourceIds(collection, property) {
      return _.uniq(_.compact(_.map(collection, (item) => {
        return ApiUtils.extractIdFromUrl(item[property]);
      })));
    }
    
    /**
     * Extracts id from resource url
     * 
     * @param {string} url resource url
     * @returns {string} id
     */
    static extractIdFromUrl(url) {
      if (!url) {
        return null;
      }
      
      const trimmed = _.trimEnd(url, '/');
      return trimmed.substr(trimmed.lastIndexOf('/') + 1);
    }
    
    static removeGeoJsonDuplicates(geometry) {
      return this.unwrapGeoJSONFeature(GeoJsonBasicUtils.removeDupeCoords(this.wrapGeoJSONFeature(geometry)));
    }
    
    static wrapGeoJSONFeature(geometry) {
      return {
        type: 'Feature',
        properties: {},
        geometry: geometry
      };
    }
    
    static unwrapGeoJSONFeature(feature) {
      return feature.geometry;
    }
    
  }
  
  module.exports = ApiUtils;

})();