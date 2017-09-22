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
    
    constructor (logger, models, search) {
      this.logger = logger;
      this.models = models;
      this.search = search;
    }
    
    getIndex(req, res) {
      res.render('index', Object.assign({
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
      
      this.search.search({ q: freeText, from: from, size: size })
        .then((result) => {
          res.send(result.hits);
        });
    }
    
    register(app, keycloak) {
      // Navigation     
      
      app.get("/", this.getIndex.bind(this));
      app.get("/version", this.getVersion.bind(this));
      app.get("/system/ping", this.getSystemPing.bind(this));
      app.post('/ajax/search', this.postAjaxSearch.bind(this));
    }
    
  };

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const models = imports['paatos-ui-models'];
    const search = imports['paatos-ui-search'];
    
    const routes = new Routes(logger, models, search);
    register(null, {
      'paatos-ui-routes': routes
    });
  };

})();
