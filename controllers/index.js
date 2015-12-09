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
  if (!(logger)) {
    throw("Failed to find logger. Logger is required.")
  }
  this.app.get('/', this.home);
  this.app.get('/about', this.aboutus);
  this.app.get('/data', this.datapage);
  this.app.get('/data/:year', this.datapage);

  this.app.post('/update', function (req, res) {

    logger.debug('attempting update');

    if (req.body.key == config.app.apiKey) {

      logger.debug("api key correct, starting update");
      var year = req.body.year || '' + new Date().getFullYear();

      dataLayer.pullSheetData(year)["catch"](function (err) {
        res.status(500).send('Failed');
        logger.error("failed to pull sheet data:");
        logger.error(err);
        throw err;
      }).then(function (sheet) {

        dataLayer.updateFromCSV(sheet)["catch"](function (err) {
          throw err;
        }).then(function (results) {
          logger.debug("new record count", {c:results});
        })

      }).done(function (results) {
        res.status(200).send('Done')
      });

    } else {
      logger.error("posted key incorrect: got:" + req.body.key + " expected:" + config.app.apiKey);
      res.status(403).send('Invalid Key');
    }
  });

  (new Api(this.app)).register();
}

Index.prototype.home = function home(req, res, next) {

  var year = String(new Date().getFullYear());

  dataLayer.getByYear(year).then(function (shootings) {

    res.locals.data = {
      recentShootings: [],
      currentYear: year,
      currentYearTotal: shootings.length,
      daysSince: '',
      daysLabel: 'days'
    };

    if (shootings && shootings.length) {

      var shooting;

      for (var i = 0; i < Math.min(5, shootings.length); i++) {

        shooting = shootings[i];
        shooting.displayDate = new moment(shooting.date).format('MM/DD/YYYY');
        res.locals.data.recentShootings.push(shooting);

      }

      var daysSince = moment().diff(moment(shootings[0].date), 'days');
      res.locals.data.daysSince = daysSince;
      res.locals.data.daysLabel = daysSince === 1 ? 'day' : 'days';
    }

  })
  .then(function () {

    res.render('index');

  });

};

Index.prototype.aboutus = function aboutus(req, res, next) {
  res.render('aboutus');
};

Index.prototype.datapage = function datapage(req, res, next) {

  var year = req.params.year || String(new Date().getFullYear());

  config.logger.debug('building datapage with param: ' + year);
  dataLayer.getByYear(year).then(function (shootings) {
    app.locals.data = shootings;
    //console.dir(data[0])

    var _i, _len, shooting;
    for (_i = 0, _len = shootings.length; _i < _len; _i++) {
      shooting = shootings[_i];
      shooting.displayDate = new moment(shooting.date).format("MM/DD/YYYY");
      shooting.number = shootings.length - _i;
    }

    res.render('data', {
      dataJson: JSON.stringify(shootings),
      year: year,
      is2015: year === "2015",
      is2014: year === "2014",
      is2013: year === "2013"
    });
  });
}