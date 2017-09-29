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
  const ApiUtils = require(__dirname + '/../../utils/apiutils.js');

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
    
    indexActions(apiId, actionsData) {
      const indexPromises = _.map(actionsData.actions, (actionResource) => {
        const caseId = ApiUtils.extractIdFromUrl(actionResource.case);
        const eventId = ApiUtils.extractIdFromUrl(actionResource.event);
        
        const caseResource = caseId ? actionsData.cases[caseId] : null;
        const eventResource = eventId ? actionsData.events[eventId] : null;
        
        const organizationId = eventResource ? ApiUtils.extractIdFromUrl(eventResource.organization) : null;
        const organizationResource = organizationId ? actionsData.organizations[organizationId] : null;
        
        const functionId = caseResource ? ApiUtils.extractIdFromUrl(caseResource.function) : null;
        const functionResource = functionId ? actionsData.functions[functionId] : null;
        
        return this.indexAction(apiId, actionResource, caseResource, eventResource, organizationResource, functionResource);
      });
      
      return Promise.all(indexPromises);
    }
    
    indexAction(apiId, actionResource, caseResource, eventResource, organizationResource, functionResource) {
      const body = {
        actionId: actionResource['id'],
        apiId: apiId,
        resultText: actionResource.title,
        title: actionResource.title,
        contentTexts: _.map(actionResource.contents, 'hypertext')
      };
      
      if (eventResource) {
        body.eventId = eventResource['id'];
        body.eventStart = eventResource['start_date'];
        body.eventEnd = eventResource['end_date'];
      }
      
      if (organizationResource) {
        body.organizationName = organizationResource.name;
      }
      
      if (caseResource) {
        body.caseTitle = caseResource.title;
        body.caseRegisterId = caseResource['register_id'];
        body.caseGeometries = {
          "type": "geometrycollection",
          "geometries": _.map(caseResource.geometries||[], (geometry) => {
            return {
              type: geometry.geometry.type,
              coordinates: geometry.geometry.coordinates
            };
          })
        };
      }
      
      if (functionResource) {
        body.functionId = functionResource['function_id'];
        body.functionName = functionResource.name;
      }
      
      return this.client
        .index({
          index: this.index,
          type: 'action',
          id: `${apiId}-${actionResource['id']}`,
          body: body
        })
        .catch((e) => {
          console.log(`Failed to index ${apiId} / ${actionResource['id']}`, e);
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
        "contentTexts": this.getTypeMapping("string", "analyzed", false),
        "functionId": this.getTypeMapping("string", "not_analyzed", true),
        "eventId": this.getTypeMapping("string", "not_analyzed", true),
        "caseRegisterId": this.getTypeMapping("string", "not_analyzed", true),
        "functionName": this.getTypeMapping("string", "analyzed", true),
        "caseTitle": this.getTypeMapping("string", "analyzed", true),
        "organizationName": this.getTypeMapping("string", "analyzed", true),
        "eventStart": this.getTypeMapping("date", null, true),
        "eventEnd": this.getTypeMapping("date", null, true),
        "caseGeometries": {
          "type": "geo_shape",
          "tree": "quadtree",
          "precision": "1m"
        }
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
      const result = {
        "store": store,
        "type": type
      };
      
      if (index) {
        result.index = index;
      }
      
      return result;
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