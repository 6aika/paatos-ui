/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const util = require('util');
  const Promise = require('bluebird');
  const Queue = require('better-queue');
  const config = require('nconf');
  
  class Tasks {
    
    constructor (logger, apiClient, search) {
      this.pageSize = 20;
      this.queueFeedSpeed = 200;
      
      this.logger = logger;
      this.apiClient = apiClient;
      this.search = search;
  
      this.search.on('indexReady', this.onSearchReady.bind(this));
      
      this.actionQueue = new Queue(this.indexCase.bind(this), { 
        autoResume: false,
        concurrent: config.get('tasks:concurrent'), 
        afterProcessDelay: config.get('tasks:afterProcessDelay'), 
        priority: (task, callback) => {
          callback(null, -task.priority);
        }
      });
      
      this.actionQueue.on('drain', this.onCaseInderersDrain.bind(this));
      
      if (!this.actionQueue.count) {
        this.queueCaseIndexTasks();
      }
      
    }
    
    onSearchReady() {
      this.actionQueue.resume();
    }
    
    indexCase(data, callback) {
      const options = {
        offset: data.page * this.pageSize,
        limit: this.pageSize
      };
      
      this.apiClient.listActions(data.apiId, options)
        .then((result) => {
          this.search.indexActions(data.apiId, result.results)
            .then(() => {
              callback();
            });
        });
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
            const pageCount = Math.ceil(count / this.pageSize); 
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