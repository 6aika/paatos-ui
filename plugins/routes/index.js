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
    
    constructor (logger, models) {
      this.logger = logger;
      this.models = models;
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
    
    register(app, keycloak) {
      // Navigation     
      
      app.get("/", this.getIndex.bind(this));
      app.get("/version", this.getVersion.bind(this));
      app.get("/system/ping", this.getSystemPing.bind(this));
    }
    
  };

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const models = imports['paatos-ui-models'];
    
    const routes = new Routes(logger, models);
    register(null, {
      'paatos-ui-routes': routes
    });
  };

})();
