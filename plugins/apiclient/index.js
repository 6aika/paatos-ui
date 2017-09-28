/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const util = require('util');
  const Promise = require('bluebird');
  const config = require('nconf');
  const PaatosClient = require('paatos-api-client');
  
  class APIClient {
    
    constructor (logger) {
      this.logger = logger;
    }
    
    findAction(apiId, actionId) {
      return this.getActionsApi(apiId)
        .actionsRetrieve(actionId);
    }
    
    findCase(apiId, caseId) {
      return this.getCasesApi(apiId)
        .casesRetrieve(caseId);
    }
    
    findFunction(apiId, functionId) {
      return this.getFunctionsApi(apiId)
        .functionsRetrieve(functionId);
    }
    
    findEvent(apiId, eventId) {
      return this.getEventsApi(apiId)
        .eventsRetrieve(eventId);
    }
    
    findOrganization(apiId, organizationId) {
      return this.getOrganizationsApi(apiId)
        .organizationsRetrieve(organizationId);
    }
    
    listActions(apiId, options) {
      return this.getActionsApi(apiId)
        .actionsList(options);
    }
    
    countActions(apiId) {
      return this.getActionsApi(apiId)
        .actionsList({
          limit: 1
        })
        .then((result) => {
          return result.count;
        });
    }
    
    getActionsApi(apiId) {
      const apiClient = this.getClient(apiId);
      return new PaatosClient.ActionsApi(apiClient);
    }
    
    getCasesApi(apiId) {
      const apiClient = this.getClient(apiId);
      return new PaatosClient.CasesApi(apiClient);
    }
    
    getEventsApi(apiId) {
      const apiClient = this.getClient(apiId);
      return new PaatosClient.EventsApi(apiClient);
    }
    
    getFunctionsApi(apiId) {
      const apiClient = this.getClient(apiId);
      return new PaatosClient.FunctionsApi(apiClient);
    }
    
    getOrganizationsApi(apiId) {
      const apiClient = this.getClient(apiId);
      return new PaatosClient.OrganizationsApi(apiClient);
    }
    
    getClient(apiId) {
      const apiConfig = config.get(`apis:${apiId}`);
      const client = new PaatosClient.ApiClient();
      client.basePath = apiConfig.url;
      return client;
    }
    
  }
  
  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const apiClient = new APIClient(logger);
    
    register(null, {
      'paatos-ui-apiclient': apiClient
    });
    
  };
  
})();