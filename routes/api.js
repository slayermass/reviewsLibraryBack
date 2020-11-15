const express = require('express');
const router = express.Router();
require('dotenv').config();

const CryptoJS = require("crypto-js");
const {AUTH_COOKIE_NAME, AUTH_COOKIE_SECRET} = require('../config');

const MongoClient = require('mongodb').MongoClient;
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});

client.connect(err => {
  if (err) {
    console.error(err);
  }
});

/** login auth */
router.post('/login', (req, res) => {
  if (req.cookies[AUTH_COOKIE_NAME]) {
    res.status(202).send('already auth');
  } else {
    const {email, password} = req.body;

    if (email && password) {

      if (client.isConnected()) {
        const collection = client.db("reviews").collection("users");

        collection
          .findOne({email: email.trim(), password: password.trim()})
          .then((user) => {
            const cookieValue = CryptoJS.AES.encrypt(JSON.stringify(user.email), AUTH_COOKIE_SECRET).toString();

            res.status(202).cookie(AUTH_COOKIE_NAME, cookieValue, {maxAge: 7 * 24 * 3600000}).send();
          })
          .catch(() => {
            res.status(400).send('no such user');
          });
      } else {
        res.status(500).send('no connection to db');
      }
    } else {
      res.status(400).send('needed email and password');
    }
  }
});

/** search in db */
router.get('/find', (req, res) => {
  const {album, group, rating, perpage = 10, page = 1} = req.query;
  const {email: userEmail} = req.user;
  const search = {};

  if (album) {
    search.a = {$regex: album, $options: "gm"};
  }
  if (group) {
    search.g = {$regex: group, $options: "gm"};
  }
  if (rating) {
    search.r = +rating;
  }

  if (client.isConnected()) {
    const collection = client.db("reviews").collection("reviews");

    collection
      .find(search)
      .sort({d: -1})
      .skip(page - 1)
      .limit(+perpage)
      .toArray((err, docs) => {
        res.json(docs);
      });
  } else {
    res.status(500).send('no connection to db');
  }
});

// router.get('/import', function(req, res, next) {1
//   const reviews = require('../json/reviews.json');
//
//   const response = Object.entries(reviews).map(([id, data]) => {
//     return {
//       a: data.album,
//       g: data.group,
//       c: data.comment,
//       r: data.rating,
//       d: data.date.value._seconds
//     }
//   });
//
//   client.connect(err => {
//     const collection = client.db("reviews").collection("reviews");
//
//     collection.insertMany(response).then(console.log)
//
//     // collection.find({ c: 'test%'}).toArray((err, docs) => {
//     //   console.log(docs);
//     // });
//     client.close();
//   });
//
//   res.json(response);
// });

module.exports = router;
