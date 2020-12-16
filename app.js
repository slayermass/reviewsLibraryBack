const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const CryptoJS = require("crypto-js");
const {AUTH_COOKIE_NAME, AUTH_COOKIE_SECRET} = require('./config');

const apiRouter = require('./routes/api');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser('ms'));

app.use('*', (req, res, next) => {
  if (req.baseUrl === '/api/login') { // на /логин всегда можно
    next();
  } else if (req.cookies[AUTH_COOKIE_NAME]) { // есть кука - проверить
    const MongoClient = require('mongodb').MongoClient;
    const uri = process.env.DB_URI;
    const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});

    client.connect(err => {
      if (err) {
        console.error('error:', err);
      }

      const bytes = CryptoJS.AES.decrypt(req.cookies[AUTH_COOKIE_NAME], AUTH_COOKIE_SECRET);
      let emailParsed = null;
      try {
        emailParsed = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      } catch (e) {
        res.clearCookie(AUTH_COOKIE_NAME);
        res.status(401).send('401 Unathorized wrong');
        return;
      }

      const collection = client.db("reviews").collection("users");
      collection
        .findOne({email: emailParsed})
        .then((user) => {
          if (user === null) {
            res.clearCookie(AUTH_COOKIE_NAME);
            res.status(401).send('401 Unathorized wrong');
          } else {
            req.user = user;
            next();
          }
        })
        .catch(() => {
          res.clearCookie(AUTH_COOKIE_NAME);
          res.status(500).send('error finding user');
        })
        .finally(() => {
          client.close();
        });
    });
  } else {
    res.status(401).send('401 Unathorized');
  }
});

app.use('/api', apiRouter);

module.exports = app;
