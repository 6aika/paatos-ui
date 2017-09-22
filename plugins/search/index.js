/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const util = require('util');
  const Promise = require('bluebird');
  const config = require('nconf');
  const elasticsearch = require('elasticsearch');
  const EventEmitter = require('events');

  class Search extends EventEmitter {
    
    constructor (logger) {
      super();
      
      this.logger = logger;
      this.index = config.get('elasticsearch:index');
      
      this.client = new elasticsearch.Client({
        host: `${config.get('elasticsearch:host')}:${config.get('elasticsearch:port')}`,
        log: config.get('elasticsearch:log')
      });
      
      this.prepareIndex()
        .then(() => {
          return this.updateMappings();
        })
        .then(() => {
          this.emit("indexReady");
        })
        .catch((e) => {
          this.logger.error('Failed to prepare index', e);
        });
    }
    
    indexActions(apiId, actions) {
      const requests = _.map(actions, (action) => {
        return this.indexAction(apiId, action);
      });
      
      return Promise.all(requests);
    }
    
    indexAction(apiId, action) {
      return this.client.index({
        index: this.index,
        type: 'action',
        id: `${apiId}-${action['id']}`,
        body: {
          actionId: action['id'],
          apiId: apiId,
          resultText: action.title,
          title: action.title,
          contentTexts: _.map(action.contents, 'hypertext')
        }
      });
    }
    
    search(options) {
      return this.client.search(options);
    }
    
    prepareIndex() {
      return this.client.indices.exists({ index: this.index })
        .then((exists) => {
          if (!exists) {
            return this.client.indices.create({ index: this.index });
          } else {
            return true;
          }
        });
    }
    
    updateMappings() {
      return this.updateMapping("action", {
        "id": this.getTypeMapping("string", "not_analyzed", true),
        "actionId": this.getTypeMapping("string", "not_analyzed", true),
        "apiId": this.getTypeMapping("string", "not_analyzed", true),
        "resultText": this.getTypeMapping("string", "not_analyzed", true),
        "title": this.getTypeMapping("string", "analyzed", false),
        "contentTexts": this.getTypeMapping("string", "analyzed", false)
      });
    }
    
    updateMapping(type, properties) {
      return this.client.indices.putMapping({
        index: this.index,
        type: type,
        body: {
          properties: properties
        }
      });
    }
    
    getTypeMapping(type, index, store) {
      return {
        "store": store,
        "index": index,
        "type": type
      };
    }
    
  }
  
  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const search = new Search(logger);
    
    register(null, {
      'paatos-ui-search': search
    });
    
  };
  
})();