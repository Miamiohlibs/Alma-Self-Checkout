const express = require("express");
const router = express.Router();
const logger = require('../helpers/logger');

router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        logger.error("Error destroying session:", err);
        return res.status(500).send("Unable to log out.");
      }
  
      // Redirect to the home page after logout
      res.redirect("/");
    });
  });

  module.exports = router;