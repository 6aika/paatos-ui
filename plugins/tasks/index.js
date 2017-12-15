/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const util = require('util');
  const Promise = require('bluebird');
  const Queue = require('better-queue');
  const config = require('nconf');
  const ApiUtils = require(__dirname + '/../../utils/apiutils.js');
  const SQLStore = require('better-queue-sql');
  
  class Tasks {
    
    constructor (logger, apiClient, search) {
      this.pageSize = 20;
      this.queueFeedSpeed = 50;
      
      this.logger = logger;
      this.apiClient = apiClient;
      this.search = search;
  
      this.taskStore = new SQLStore({
        dialect: 'mysql',
        tableName: config.get('tasks:tableName'),
        dbname: config.get('mysql:database'),
        host: config.get('mysql:host') || 'localhost',
        port: config.get('mysql:port') || 3306,
        username: config.get('mysql:username'),
        password: config.get('mysql:password')
      });
      
      this.actionQueue = new Queue(this.indexAction.bind(this), {
        autoResume: false,
        concurrent: config.get('tasks:concurrent'), 
        afterProcessDelay: config.get('tasks:afterProcessDelay'), 
        maxTimeout: 20000,
        priority: (task, callback) => {
          callback(null, -task.priority);
        }
      });

      this.actionQueue.use(this.taskStore);
      this.actionQueue.on('drain', this.onCaseInderersDrain.bind(this));

      if (this.search.getIndexReady()) {
        this.startTasks();
      } else {
        this.search.on('indexReady', this.onSearchReady.bind(this));
      }
      
    }
    
    onSearchReady() {
      this.startTasks();
    }
    
    startTasks() {
      this.taskStore.getRunningTasks((err, tasks) => {
        if (!tasks || !Object.keys(tasks).length) {
          this.queueCaseIndexTasks();
        }

        this.actionQueue.resume();
      });
    }
    
    indexAction(data, callback) {
      if (config.get('tasks:log:debug')) {
        console.log(`Indexing action with id ${data.id}`);
      }
      this.loadActionDatas(data.apiId, data.page * this.pageSize, this.pageSize)
        .then((result) => {
          return this.search.indexActions(data.apiId, result);
        })
        .then(() => {
          callback();
        });
    }
    
    loadActionDatas(apiId, offset, limit) {
      const options = {
        offset: offset,
        limit: limit
      };
      
      return this.apiClient.listActions(apiId, options)
        .then((result) => {
          const actions = result.results;
          const caseIds = ApiUtils.extractUrlResourceIds(actions, 'case');
          const eventIds = ApiUtils.extractUrlResourceIds(actions, 'event');
          
          return Promise.all([this.findCases(apiId, caseIds), this.findEvents(apiId, eventIds)])
            .then((caseEventData) => {
              const cases = this.preprocessCases(caseEventData[0]);
              const events = caseEventData[1];
              
              const functionIds = ApiUtils.extractUrlResourceIds(cases, 'function');
              const organizationIds = ApiUtils.extractUrlResourceIds(events, 'organization');
              
              return Promise.all([this.findFunctions(apiId, functionIds), this.findOrganizations(apiId, organizationIds)])
                .then((functionOrganizationData) => {
                  return {
                    actions: _.keyBy(actions, 'id'),
                    cases: _.keyBy(cases, 'id'),
                    events: _.keyBy(events, 'id'),
                    functions: _.keyBy(functionOrganizationData[0], 'id'),
                    organizations: _.keyBy(functionOrganizationData[1], 'id')
                  };
                });
            });
        });
    }
    
    findCases(apiId, caseIds) {
      const findPromises = _.map(caseIds, (caseId) => {
        return this.apiClient.findCase(apiId, caseId);
      });
      
      return Promise.all(findPromises);
    }
    
    findEvents(apiId, eventIds) {
      const findPromises = _.map(eventIds, (eventId) => {
        return this.apiClient.findEvent(apiId, eventId);
      });
      
      return Promise.all(findPromises);
    }
    
    findFunctions(apiId, functionIds) {
      const findPromises = _.map(functionIds, (functionId) => {
        return this.apiClient.findFunction(apiId, functionId);
      });
      
      return Promise.all(findPromises);
    }
    
    findOrganizations(apiId, organizationIds) {
      const findPromises = _.map(organizationIds, (organizationId) => {
        return this.apiClient.findOrganization(apiId, organizationId);
      });
      
      return Promise.all(findPromises);
    }
    
    preprocessCases(caseResources) {
      return _.map(caseResources, (caseResource) => {
        return this.preprocessCase(caseResource);
      });
    }
    
    preprocessCase(caseResource) {
      if (caseResource.geometries) {
        caseResource.geometries.forEach((geometryItem) => { 
          geometryItem.geometry = ApiUtils.removeGeoJsonDuplicates(geometryItem.geometry);
        });
      }
      
      return caseResource;
    }
    
    queueCaseIndexTasks() {
      const apiIds = Object.keys(config.get(`apis`));
      
      const requests = _.map(apiIds, (apiId) => {
        return this.apiClient.countActions(apiId);
      });
      
      Promise.all(requests)
        .then((counts) => {
          const queuePromises = [];
          
          for (let i = 0; i < counts.length; i++) {
            const count = counts[i];
            const apiId = apiIds[i];
            const pageCount = Math.ceil(count / this.pageSize) - 1; 
            queuePromises.push(this.queueCaseIndexTasksPages(apiId, pageCount));
          }
          
          return Promise.all(queuePromises);
        });
    }
    
    queueCaseIndexTasksPages(apiId, pageCount) {
      const taskDatas = [];
      
      for (let page = pageCount; page >= 0; page--) {
          taskDatas.push({
            "id": `${apiId}:action:${page}`,
            "apiId": apiId,
            "page": page,
            "priority": pageCount - page
          });
      }
      
      return Promise.each(taskDatas, (taskData) => {
        return this.queueCaseIndexTasksPage(taskData);
      });
    }
    
    queueCaseIndexTasksPage(taskData) {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (config.get('tasks:log:debug')) {
            console.log(`Added task ${taskData.id} to queue`);
          }
          this.actionQueue.push(taskData);
          resolve();
        }, this.queueFeedSpeed);
      });
    }
   
    onCaseInderersDrain() {
      this.queueCaseIndexTasks(); 
    }
    
  } 
  
  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const apiClient = imports['paatos-ui-apiclient'];
    const search = imports['paatos-ui-search'];
    const tasks = new Tasks(logger, apiClient, search);
    
    register(null, {
      'paatos-ui-tasks': tasks
    });
    
  };
  
})();