/* jshint esversion: 6 */
/* global __dirname */
(() => {
  'use strict';
  
  /**
   * Parses a list of function ids from txt file.
   */
  
  const fs = require('fs');
  const request = require('request');
  const _ = require('lodash');
  
  const resultFile = process.argv[2];
  const fileUrls = ['https://raw.githubusercontent.com/Metatavu/paatos/master/data/tehtavaluokat-espoo.txt', 'https://raw.githubusercontent.com/Metatavu/paatos/master/data/tehtavaluokat-oulu.txt'];
  
  const result = {};
  
  function requestFiles(urls) {
    const requests = _.map(urls, (url) => {
      return new Promise((resolve) => {
        request(url, (error, response, body) => {
          resolve(body);
        });
      });
    });
    
    return Promise.all(requests);
  }
  
  requestFiles(fileUrls).then((bodies) => {
    let datas = bodies.join('\n');
    const lines = datas.split('\n');
    
    const lineDatas = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^([0-9]{2}\.{0,1}){1,}\ .*/)) {
        const nameIndex = line.indexOf(' ');
        
        const name = _.trim(line.substring(nameIndex + 1));
        const id = line.substring(0, nameIndex);
        
        lineDatas.push({
          id: id.replace(/\./g, ' '),
          name: _.capitalize(name.toLowerCase()),
          level: _.sumBy(id, (char) => {
            return char === '.' ? 1 : 0;
          })
        });
      }
    }
    
    const sortedLines = _.sortBy(lineDatas, ['level', 'id']);
    
    _.forEach(sortedLines, (lineData) => {
      const idTree = lineData.id.split(' ');
      if (idTree.length === 1) {
        result[idTree[0]] = lineData;
      } else {
        const leftId = idTree.pop();
        let parentNode = result[idTree[0]];
        
        for (let i = 1; i < idTree.length; i++) {
          parentNode = parentNode.children[idTree[i]];
        }
        
        if (parentNode) {
          parentNode.children = (parentNode.children || {});
          parentNode.children[leftId] = lineData;
        }
      }
    });
    
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
  });
  
})();