const appConfig = require('../config/config'); 
const express = require("express");
const router = express.Router();
const axios = require('axios');
const utils = require('../helpers/utils');
const logger = require('../helpers/logger');


//ensure user is authenticated before allowing access to checkout route
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user_id) {
    return next();
  } else {
    req.session.message = {
    type: "danger",
    text: `Error: Authentication error. Please log in again.`,
    };
    return res.redirect("/");
  }
}

//route for checking out items, called from loans.ejs when user scans an item
router.post("/checkout", ensureAuthenticated, async (req, res) => {
    const barcode = req.body.barcode?.trim().replace(/[^\w\-]/g, ""); //sanitize input
    const user_id = req.session.user_id;
    const postData = {
      circ_desk: { value: appConfig.alma_circ_desk },
      library: { value: appConfig.alma_library },
    };
  
    //make sure barcode value exists
    if (!barcode) {
      return res.status(400).send("Barcode is required");
    }
  
    // make sure item barcode is valid
    if (!utils.validateItemBarcode(barcode)) {
        logger.error(`Invalid barcode: ${barcode}`);
        req.session.message = {
          type: "danger",
          text: `Error: Invalid Barcode. Unable to check out item ${barcode}. Please see the circulation desk.`,
      };
      return res.redirect("/");
    }
  
    // API checkout URL
    const loanURL = `${appConfig.AlmaAPI}/almaws/v1/users/${user_id}/loans?item_barcode=${barcode}&format=json`;
  
    try {
      // post item to API with a 10-second timeout (Alma's API is slow to send a response sometimes)
      // the actual checkout always goes through, so just skip waiting for the response after 10 seconds
      const response = await axios.post(loanURL, postData, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
          "Content-Type": "application/json",
          "Authorization": `apikey ${appConfig.API_KEY}`,
        },
        timeout: 10000, // 10 seconds timeout
      });
  
      //format due date
      const date = new Date(response.data.due_date);
      logger.info(`${response.data.item_barcode} successfully checked out`);
      // Store success message in the session
      req.session.message = {
        type: "success",
        text: "has been successfully checked out",
        title: response.data.title,
        barcode: response.data.item_barcode,
        duedate: "Due Date: " + date.toISOString().split("T")[0],
      };
  
      res.redirect("/");
    } catch (error) {
      // Check if error is a timeout error; occasionally the Alma API times out while waiting for a response
      // if so just send the barcode back, on page reload it will verify for the user whether the item was successfully checked out (it usually is) 
      if (error.code === "ECONNABORTED") {
        logger.error("Alma API did not respond in the allotted time");
        req.session.message = {
          type: "danger",
          barcode: barcode,
          text: "Error: API did not return a response in the alloted time. <br>Please verify below that your item has been checked out.",
        };
      } else if (error.response) {
        const almaError = error.response.data;
        logger.error("Error from Alma API:", almaError);
        req.session.message = {
          type: "danger",
          text: `Error. Unable to check out item ${barcode}. Please see the circulation desk.`,
        };
      } else {
        logger.error("Unexpected error:", error.message);
        req.session.message = {
          type: "danger",
          text: "Error. An unexpected error occurred. Please try again later.",
        };
      }
      res.redirect("/");
    }
  });
  

  module.exports = router;