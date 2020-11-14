const express = require('express');
const router = express.Router();
require('dotenv').config();


const MongoClient = require('mongodb').MongoClient;
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {useNewUrlParser: true});

client.connect(err => {
  if (err) {
    console.error(err);
  }
})


/** GET users listing. */
router.get('/', (req, res) => {
  const reviews = require('../json/mock.json').reviews;

  const response = reviews.filter((item) => {
    return item.g.toLowerCase().includes('a') || item.a.toLowerCase().includes('a');
  });

  res.json(response);
});

/** search in db */
router.get('/find', (req, res) => {
  const {album, group, rating} = req.query;
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

    collection.find(search).toArray((err, docs) => {
      res.json(docs);
    });
  } else {
    res.status(500);
    res.send('no connection to db');
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
