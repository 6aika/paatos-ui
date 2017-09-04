/* jshint esversion: 6 */
/* global module:false */

const _ = require('lodash');
const fs = require('fs');
const util = require('util');
const pug = require('pug');

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);
  
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
          ext: '.js'
        }]
      }
    }
  });
  
  grunt.registerTask('default', [ 'sass', 'babel' ]);
};