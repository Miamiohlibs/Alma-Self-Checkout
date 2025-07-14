const appConfig = require('../config/config'); 
const express = require("express");
const router = express.Router();
const axios = require('axios');
const utils = require('../helpers/utils');

router.post("/auth", async (req, res) => {
    try {  
        const userBarcode = req.body.barcode?.trim().replace(/[^\w\-]/g, ""); //sanitize input 

        //validate barcode checksum
        if (!utils.validatePatronBarcode(userBarcode)){
            req.session.message = {
                type: "danger",
                text: "Error: Invalid Barcode. Please see the circulation desk.",
                };
                return res.redirect("/");
        }
        try {
            // get user's Alma primary ID from scanned barcode
            const response = await axios.get(
            `${appConfig.AlmaAPI}/almaws/v1/users?limit=10&offset=0&q=identifiers~${userBarcode}&order_by=last_name%2C%20first_name%2C%20primary_id&expand=none&format=json`,
            {headers: { 'Authorization' : `apikey ${appConfig.API_KEY}` }}
            );

            //check number of results, make sure there is only one
               if (response.data.total_record_count === 1) {
                req.session.user_id = response.data.user[0].primary_id;
                
            // sample user if using Alma's sandbox API
            //if (response.data.total_record_count === 0) {
            //req.session.user_id = 'octavio.acevedo';

            
                console.log(`[${new Date().toISOString()}] User ${req.session.user_id} authenticated successfully`);
                req.session.authenticated = true;
                //redirect user to main page after authenticating 
                req.session.save((err) => {
                    if (err) {
                        console.error("Session save error:", err);
                        return res.status(500).send("Session error");
                    }
                    res.redirect("/");
                });

            }
            else {
                console.log(`[${new Date().toISOString()}] No user found for ${userBarcode}`);
                req.session.message = {
                    type: "danger",
                    text: "Error: No User Found. Please see the circulation desk.",
                };

                return res.redirect("/");
            }
        // error handling and whatnot
        } catch (error) {
            console.log(error)
            const almaError = error.response.data
            const mssgError = "API error. Please see the circulation desk."
            console.error("Error fetching data:", almaError);
            return res.render("error", { mssgError });
        }
    }

    catch {
        console.error("Error in /auth route:", err);
        res.status(500).send("Internal Server Error");
    }
    
  });

module.exports = router;
