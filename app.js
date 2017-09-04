/* jshint esversion: 6 */
/* global __dirname */
(() => {
  'use strict';
  
  const architect = require('architect');
  const _ = require('lodash');
  const http = require('http');
  const util = require('util');
  const path = require('path');
  const express = require('express');
  const request = require('request');
  const config = require('nconf');
  const i18n = require('i18n-x');
  const Keycloak = require('keycloak-connect');  
  const session = require('express-session');
  const SequelizeStore = require('connect-session-sequelize')(session.Store);
  
  config.file({file: __dirname + '/config.json'});
   
  const options = require(__dirname + '/options');
  const architectConfig = architect.loadConfig(__dirname + '/config.js');
  
  if (!options.isOk()) {
    options.printUsage();
    process.exitCode = 1;
    return;
  }
  
  architect.createApp(architectConfig, (err, architectApp) => {
    if (err) {
      console.error(err);
      process.exitCode = 1;
      return;
    }
    
    const sequelize = architectApp.getService('shady-sequelize').sequelize;
    const Sequelize = architectApp.getService('shady-sequelize').Sequelize;
    const models = architectApp.getService('paatos-ui-models');
    const routes = architectApp.getService('paatos-ui-routes');
    const logger = architectApp.getService('logger');
    
    const port = options.getOption('port');
    const host = options.getOption('host');
    const app = express();
    const httpServer = http.createServer(app);
    
    const sessionStore = new SequelizeStore({
      db: sequelize,
      table: "ConnectSession"
    });
    
    sessionStore.sync();
    
    const keycloak = new Keycloak({ store: sessionStore }, {
      "realm": config.get('keycloak:realm'),
      "auth-server-url": config.get('keycloak:auth-server-url'),
      "ssl-required": config.get('keycloak:ssl-required'),
      "resource": config.get('keycloak:resource'),
      "public-client": config.get('keycloak:public-client')
    });
    
    httpServer.listen(port, () => {
      logger.info('Http server started');
    });
    
    app.use(session({
      store: sessionStore,
      resave: false,
      saveUninitialized: true,
      secret: config.get('session-secret')
    }));
    
    app.use(i18n({
      locales: ['fi', 'en']
    }));
    
    app.use(keycloak.middleware({
      logout: '/logout'
    }));
    
    app.use((req, res, next) => {
      req.paatosUiCommon = {
        isLoggedIn: req.kauth && req.kauth.grant
      };
      
      next();
    });
    
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });

    app.use(express.static(path.join(__dirname, 'public')));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'pug');
    
    routes.register(app, keycloak);
  });

})();