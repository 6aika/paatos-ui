/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const _ = require('lodash');
  const fs = require('fs');
  const moment = require('moment');
  const config = require('nconf');
  const request = require('request');
  
  class Routes {
    
    constructor (logger, models, search, apiClient) {
      this.logger = logger;
      this.models = models;
      this.search = search;
      this.apiClient = apiClient;
    }
    
    getIndex(req, res) {
      res.render('index', Object.assign({
        apis: _.map(config.get(`apis`), (config, id) => {
          return {
            id: id,
            name: config.name
          };
        }),
        locale: req.i18n.getLocale()
      }, req.paatosUiCommon));
    }
    
    getSystemPing(req, res) {
      res.send("PONG");
    }

    getVersion(req, res) {
      res.send(config.get('app-version'));
    }
    
    postAjaxSearch(req, res) {
      const freeText = req.body.freeText;
      const from = parseInt(req.body.from);
      const size = parseInt(req.body.size);
      const apiIds = req.body.apiIds || Object.keys(config.get('apis'));
      const geoJson = req.body.geoJson;
      const functionId = req.body.functionId;
      const eventWithinStart = req.body.eventWithinStart;
      const eventWithinEnd = req.body.eventWithinEnd;
      const must = [];
      const filter = {};
      
      must.push({
        "terms" : {
          "apiId" : apiIds 
        }
      });
        
      if (freeText) {
        must.push({
          "match" : {
            "contentTexts" : freeText
          }
        });
      }
      
      if (geoJson) {
        filter["geo_shape"] = {
          "caseGeometries": {
            "shape": JSON.parse(geoJson),
            "relation": "within"
          }
        };
      }
      
      if (functionId) {
        must.push({
          "prefix": {
            "functionId": functionId
          }
        });
      }
      
      if (eventWithinStart && eventWithinEnd) {
        must.push({
          "range" : {
            "eventStart" : {
              "lte" : eventWithinEnd
            }
          }
        });
        
        must.push({
          "range" : {
            "eventEnd" : {
              "gte" : eventWithinStart
            }
          }
        });
      }
        
      const queryBody = {
        query: {
          "bool": {
            "must": must,
            "filter": filter
          }
        }
      };
      
      this.search.search({ body: queryBody, from: from, size: size })
        .then((result) => {
          res.send(result.hits);
        });
    }
    
    getAjaxAction(req, res) {
      const apiId = req.params.apiId;
      const actionId = req.params.actionId;
      
      this.apiClient.findAction(apiId, actionId)
        .then((action) => {
          if (action) {
            res.send(action);
          } else {
            res.status(404).send();
          }
        })
        .catch((err) => {
          res.status(500).send(err);
        });
    }
    
    register(app, keycloak) {
      // Navigation     
      
      app.get("/", this.getIndex.bind(this));
      app.get("/version", this.getVersion.bind(this));
      app.get("/system/ping", this.getSystemPing.bind(this));
      app.post('/ajax/search', this.postAjaxSearch.bind(this));
      app.get('/ajax/action/:apiId/:actionId', this.getAjaxAction.bind(this));
    }
    
  };

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const models = imports['paatos-ui-models'];
    const search = imports['paatos-ui-search'];
    const apiClient = imports['paatos-ui-apiclient'];
    
    const routes = new Routes(logger, models, search, apiClient);
    register(null, {
      'paatos-ui-routes': routes
    });
  };

})();
