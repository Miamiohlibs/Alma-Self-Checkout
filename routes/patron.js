const appConfig = require('../config/config'); 
const express = require("express");
const router = express.Router();
const axios = require('axios');

//route to load patron record 
router.get("/", async (req, res) => {
    let message = req.session.message || null;
    delete req.session.message; // clear  message after passing it to the template
    if (req.session.authenticated && req.session.user_id) {
        const user_id = req.session.user_id;
        try {
          // retrieve user details from api
          const userresponse = await axios.get(
            `${appConfig.AlmaAPI}/almaws/v1/users/${user_id}?apikey=${appConfig.API_KEY}&expand=loans,requests,fees&format=json`
          );
          const userdata = userresponse.data;
          //retrieve user loans from api
          const response = await axios.get(
            `${appConfig.AlmaAPI}/almaws/v1/users/${user_id}/loans?apikey=${appConfig.API_KEY}&format=json`
          );
          const loandata = response.data;
          console.log(`[${new Date().toISOString()}] Retrieved patron record for ${user_id}`);
          // render the loans table
          res.render("patronrecord", { 
            ...appConfig.institutionDetails,
            userdata, 
            loandata, 
            message,
            maxInactivityTimeout: (appConfig.inactivityTimeout * 1000 * 60),
          });
        } catch (error) {
          console.error("Error retrieving patron record:", error);
          res.status(500).send("Error retrieving patron record.");
        }
      } else {
        // if not authenticated, display the welcome page
        res.render("welcome", { ...appConfig.institutionDetails, message }); 
      }
  });



  module.exports = router;
