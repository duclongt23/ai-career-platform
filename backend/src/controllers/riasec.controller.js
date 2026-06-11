const onetInterest = require("../data/onetInterest.json");

function listQuestions(req, res) {
  return res.json(onetInterest);
}

module.exports = { listQuestions };
