/* jshint esversion: 6 */
/* global module:false */

const _ = require('lodash');
const fs = require('fs');
const util = require('util');
const pug = require('pug');
const path = require('path');

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);
  
  grunt.registerMultiTask('compile-client-templates', 'Compiles client pug templates', function () {
    const clientTemplates = fs.readdirSync(this.data.sourceFolder);
    const compiledClientTemplates = [];
    
    for (let i = 0; i < clientTemplates.length; i++) {
      let baseName = clientTemplates[i].replace('.pug', '');
      baseName = `${baseName[0].toUpperCase()}${baseName.substring(1)}`;
      const templateName = _.camelCase(`${this.data.templatePrefix}${baseName}`);
      compiledClientTemplates.push(pug.compileFileClient(this.data.sourceFolder + clientTemplates[i], { name: templateName, compileDebug: false }));
    }
    
    const destDir = path.dirname(this.data.destFile);
    
    if (!fs.existsSync(destDir)){
      fs.mkdirSync(destDir);
    }
    
    fs.writeFileSync(this.data.destFile, compiledClientTemplates.join(''));
  });
  
  grunt.initConfig({
    'sass': {
      dist: {
        options: {
          style: 'compressed'
        },
        files: [{
          expand: true,
          cwd: 'src/scss',
          src: ['*.scss'],
          dest: 'public/css',
          ext: '.min.css'
        }]
      }
    },
    'compile-client-templates': {
      'compile': {
        'sourceFolder': __dirname + '/src/templates/',
        'destFile': __dirname + '/public/js/pug-templates.min.js',
        'templatePrefix': 'pug'
      }
    },
    'babel': {
      options: {
        sourceMap: true,
        minified: true
      },
      dist: {
        files: [{
          expand: true,
          cwd: 'src/js',
          src: ['*.js'],
          dest: 'public/js/',
          ext: '.min.js'
        }]
      }
    }
  });
  
  grunt.registerTask('default', [ 'sass', 'babel', 'compile-client-templates' ]);
};