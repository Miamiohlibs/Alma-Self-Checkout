const express = require("express");
const router = express.Router();

// POST, not GET: a GET logout can be triggered by any page that can make the
// browser issue a request (an <img> tag is enough), and side effects do not
// belong on a safe method.
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err.message);
        return res.status(500).send("Unable to log out.");
      }

      // drop the now-orphaned cookie as well as the stored session
      res.clearCookie('connect.sid');

      // Redirect to the home page after logout
      res.redirect("/");
    });
  });

  module.exports = router;
