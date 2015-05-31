/* 
* @Author: justinwebb
* @Date:   2015-05-26 15:18:17
* @Last Modified by:   justinwebb
* @Last Modified time: 2015-05-31 08:50:40
*/

'use strict';

// ---------------------------------------------------------
// Require build process dependencies
// ---------------------------------------------------------
var gulp = require('gulp');
var gUtil = require('gulp-util');
var browserSync = require('browser-sync');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var inject = require('gulp-inject');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var streamSeries = require('stream-series');
var nodemon = require('gulp-nodemon');
var html2js = require('gulp-html2js');
var config = require('./build-config');
var browserSyncReload = browserSync.reload;
var ngAnnotate = require('gulp-ng-annotate');
var changed = require('gulp-changed');

// ---------------------------------------------------------
// Setup task configurations
// ---------------------------------------------------------

var cleanPreviousBuild = function (cb) {
  del([config.dist]);
  cb();
};

var compileSassFiles = function (cb) {
  gulp.src(config.appFiles.scss)
    .on('error', sass.logError)
    .pipe(sourcemaps.init())
    .pipe(sass({
        includePaths: [config.importPath.fontawesomeSass],
        sourcemap: true
      })
    )
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(config.assets +'/styles'))
    .pipe(browserSyncReload({stream: true}));

  cb();
};

var transformSourceToDistFiles = function (cb) {
  var startTag = {starttag: '<!-- inject:head:{{ext}} -->'};
  var cssDest = config.assets +'/styles/main.css';
  var cssOptions = {
    addRootSlash: false,
    ignorePath: ['dist', 'client']
  };
  var jsOptions = {
    addRootSlash: false,
    ignorePath: ['dist', 'client']
  };

  // Concatenate vendor scripts 
  var vendorStream = gulp.src(config.vendorFiles.js)
    .pipe(concat('src/vendor.js'))
    .pipe(gulp.dest(config.dist));
   
  // Concatenate AND minify app sources 
  var appStream = gulp.src(config.appFiles.js)
    .pipe(ngAnnotate())
    .pipe(concat('src/constellation-app.js'))
    .pipe(uglify())
    .pipe(gulp.dest(config.dist));

  // Inject CSS and JS into index.html
  gulp.src(config.client +'/index.html')
    .pipe(inject(gulp.src(cssDest, {read: false}), cssOptions), startTag)
    .pipe(inject(streamSeries(vendorStream, appStream), jsOptions))
    .pipe(gulp.dest(config.dist));

  cb();
};

var runNodemon = function (cb) {
  var isActive = false;
  return nodemon({
    script: config.server +'/server.js',
    watch: [config.server +'/**/*.js']
  })
    .on('start', function onStart() {
      gUtil.log('runNodemon:\tstarting up...');
      if (!isActive) {
        isActive = true;
        cb();
      }
    })
    .on('restart', function onRestart() {
      setTimeout(function reload() {
        browserSyncReload({stream: false});
      }, 500);
    });
};

// ---------------------------------------------------------
// Register tasks
// ---------------------------------------------------------
gulp.task('clean', cleanPreviousBuild);

gulp.task('sass', compileSassFiles);

gulp.task('dist', transformSourceToDistFiles);

gulp.task('build', ['clean', 'sass', 'dist']);

gulp.task('nodemon', runNodemon);

gulp.task('update-js', ['dist'], browserSyncReload);

gulp.task('update-html', ['dist'], function () {
  setTimeout(browserSyncReload, 500);
});

gulp.task('serve', ['build', 'nodemon'], function () {
  
  var port = process.env.PORT || 3999;

  browserSync.init({
    server: {
      baseDir: config.dist,
      proxy: 'http://localhost:'+ port,
    }
  });

  gulp.watch(config.appFiles.scss, ['sass']);
  gulp.watch(config.appFiles.js, ['update-js']);
  gulp.watch(config.appFiles.html, ['update-html']);
});

gulp.task('default', ['serve']);
