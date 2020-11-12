const express = require('express');
const router = express.Router();


/** GET users listing. */
router.get('/', function(req, res, next) {
  const reviews = require('../json/mock.json').reviews

  const response = reviews.filter((item) => {
    return item.g.toLowerCase().includes('a') || item.a.toLowerCase().includes('a');
  });

  res.json(response);
});

module.exports = router;
