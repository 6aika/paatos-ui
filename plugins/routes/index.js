/*jshint esversion: 6 */
/* global __dirname, Promise */

(() => {
  'use strict';
  
  const _ = require('lodash');
  const fs = require('fs');
  const moment = require('moment');
  const config = require('nconf');
  const request = require('request');
  const RSS = require('rss');
  
  class Routes {
    
    constructor (logger, models, search, apiClient) {
      this.logger = logger;
      this.models = models;
      this.search = search;
      this.apiClient = apiClient;
    }
    
    getIndex(req, res) {
      const preRenderTasks = [];
      let savedSearch = null;
      if (req.query.search) {
        preRenderTasks.push(this.models.findSavedSearch(req.query.search));
      }
      
      Promise.all(preRenderTasks)
        .then((result) => {
          savedSearch = result ? result[0] : null;
        })
        .catch((error) => {
          console.error(error);
        })
        .then(() => {
          res.render('index', Object.assign({
            savedSearch: savedSearch ? savedSearch.search : null,
            apis: _.map(config.get(`apis`), (config, id) => {
              return {
                id: id,
                name: config.name
              };
            }),
            locale: req.i18n.getLocale()
          }, req.paatosUiCommon));
        });
    }
    
    getSystemPing(req, res) {
      res.send("PONG");
    }
    
    getSingleAction(req, res) {
      const apiId = req.params.apiId;
      const actionId = req.params.actionId;
      
      this.apiClient.findAction(apiId, actionId)
        .then((action) => {
          if (action) {
            res.render('action', {
              title: action.title,
              contents: action.contents
            });
          } else {
            res.status(404).send('Not found');
          }
        })
        .catch((err) => {
          res.status(500).send(err);
        });
    }
    
    postAjaxSearch(req, res) {
      const searchObject = this.parseSearchObject(req.body);
      
      this.search.search(searchObject)
        .then((result) => {
          res.send(result.hits);
        });
    }
    
    postAjaxSearchSave(req, res) {
      const searchObject = this.parseSearchObject(req.body);
      this.models.createSavedSearch(JSON.stringify(searchObject), null)
        .then((savedSearch) => { res.send(savedSearch) })
        .catch((err) => { res.status(500).send(err) });
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
    
    getAjaxGeocode(req, res) {
      const location = req.query.location;
      
      if (!location) {
        return res.status(400).send();
      }
      
      const geoServiceUrl = `${config.get('geocode:url')}?key=${config.get('geocode:key')}&location=${location}`;
      request.get({
        url: geoServiceUrl,
        json: true
      }, (err, response, data) => {
        if (err) {
          res.status(500).send(err);
        } else {
          if (data.results && data.results[0].locations && data.results[0].locations[0]) {
            const bestLocation = data.results[0].locations[0];
            res.send(bestLocation.latLng);
          } else {
            res.status(404).send();
          }
        }
      });
    }
    
    getRssSearch(req, res) {
      const searchId = req.params.searchId;
      this.models.findSavedSearch(searchId)
        .then((savedSearch) => {
          if (!savedSearch) {
            return null;
          } else {
            const searchObject = JSON.parse(savedSearch.search);
            return this.search.search(searchObject);
          }
        })
        .then((result) => {
          if (result) {
            const siteUrl = `${req.protocol}://${req.get('host')}`
            const feedUrl = `${siteUrl}${req.originalUrl}`
            const feed = new RSS({
              title: "Päätöshaku",
              site_url: siteUrl,
              feed_url: feedUrl
            });

            const hits = result.hits.hits;
             for (let i = 0; i < hits.length; i++) {
               const source = hits[i]._source;
               feed.item({
                 title: source.title,
                 description: source.resultText,
                 url: `${siteUrl}/action/${source.apiId}/${source.actionId}`,
                 guid: `${source.apiId}-${source.actionId}`,
                 author: `${config.get(`apis:${source.apiId}`).name} / ${source.organizationName}`,
                 date: source.eventStart
               });
             }
             res.header("Content-Type", "application/rss+xml");
             res.send(feed.xml());
          } else {
            res.status(404).send();
          }
        })
        .catch((err) => {
          res.status(500).send(err);
        });
    }
    
    parseSearchObject(body) {
      const freeText = body.freeText;
      const from = parseInt(body.from);
      const size = parseInt(body.size);
      const apiIds = body.apiIds || Object.keys(config.get('apis'));
      const geoJson = body.geoJson;
      const functionId = body.functionId;
      const eventWithinStart = body.eventWithinStart;
      const eventWithinEnd = body.eventWithinEnd;
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
      
      if (eventWithinEnd) {
        must.push({
          "range" : {
            "eventStart" : {
              "lte" : eventWithinEnd
            }
          }
        });
      }

      if (eventWithinStart) {
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
      
      return { body: queryBody, from: from, size: size, sort: ['_score', 'resultText'] };
    }
    
    register(app, keycloak) {
      // Navigation     
      
      app.get("/", this.getIndex.bind(this));
      app.get("/system/ping", this.getSystemPing.bind(this));
      app.get('/action/:apiId/:actionId', this.getSingleAction.bind(this));
      app.post('/ajax/search', this.postAjaxSearch.bind(this));
      app.get('/ajax/gecode', this.getAjaxGeocode.bind(this));
      app.post('/ajax/search/save', this.postAjaxSearchSave.bind(this));
      app.get('/ajax/action/:apiId/:actionId', this.getAjaxAction.bind(this));
      app.get('/rss/:searchId', this.getRssSearch.bind(this));
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
