'use strict';

var _ = require('lodash');
var Api = require('./api');
var path = require('path');
var moment = require('moment');
var config = require(path.join(process.cwd(), './config'))
var dataLayer = null;
var app = null

function Index(appArg) {
  this.app = appArg;
  dataLayer = new (require(path.join(process.cwd(), './services/data.js'))).Data(config, config.logger);
  app = this.app;
  _.bindAll(this, 'home');
}

module.exports = Index;

Index.prototype.register = function () {
  var datapage = this.datapage;
  var logger = config.logger;
  if (!(logger)){
   throw("Failed to find logger. Logger is required.")
  }
  this.app.get('/', this.home);
  this.app.get('/about', this.aboutus);
  this.app.get('/data', this.datapage);
  this.app.post('/update', function (req, res) {
    logger.debug('attempting update');
    if (req.body.key == config.app.apiKey) {
      logger.debug("api key correct, starting update");

      dataLayer.pullSheetData()["catch"](function (err) {
        res.status(500).send('Failed');
        logger.error("failed to pull sheet data:");
        logger.error(err);
        throw err;
      }).then(function (sheet) {
        dataLayer.updateFromCSV(sheet)["catch"](function (err) {
          res.status(500).send('Failed');
          throw err;
        }).then(function (results) {
          logger.debug({ csv_update_results: results });
        })
      }).done(function (results) {
        res.status(200).send('Done')
      });

    } else {
      logger.error("posted key incorrect: got:" + req.body.key + " expected:" + config.app.apiKey);
      res.status(403).send('Invalid Key');
    }
  });

  this.app.get('/:year(\\d{4})/', function (req, res) {
    datapage(req, res);
  });
  (new Api(this.app)).register();
}

Index.prototype.home = function home(req, res, next) {
  dataLayer.getTotals().then(function (data) {
    app.locals.data = data;
    data.currentYear = data[new Date().getFullYear()];
    //console.dir(data);
    res.render('index');
  });
}

Index.prototype.aboutus = function aboutus(req, res, next) {
  res.render('aboutus');
}

Index.prototype.datapage = function datapage(req, res, next) {
  config.logger.debug('building datapage with param: ' + req.params.year);
  dataLayer.getByYear(+req.params.year).then(function (data) {

    data.map(function (x) {
      x.date = new moment(x.data).format("MM/DD/YYYY")
    });
    app.locals.data = data;
    //console.dir(data[0])
    res.render('data');
  });
}