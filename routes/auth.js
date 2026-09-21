const appConfig = require('../config/config'); 
const express = require("express");
const router = express.Router();
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const utils = require('../helpers/utils');

// One message for every failure path. A caller must not be able to tell a
// badly formed barcode from a well formed one that matches no patron, since
// that difference turns this route into a barcode-enumeration oracle.
const AUTH_FAILED_MESSAGE = "Error: Unable to sign in. Please see the circulation desk.";

// A barcode is the only credential this station asks for, so anyone who can
// reach /auth can guess at patron barcodes -- and library barcodes are often
// sequential. Only FAILED attempts count against the quota, so a busy station
// whose patrons all share one source IP is never locked out by real scans.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20, // failed attempts per window
    requestWasSuccessful: (req) => req.session?.authenticated === true,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`[${new Date().toISOString()}] Too many failed authentication attempts from ${req.ip}`);
        req.session.message = {
            type: "danger",
            text: AUTH_FAILED_MESSAGE,
        };
        return res.redirect("/");
    },
});

// promisified wrappers so the session steps below read in the same
// async/await style as the API call, and surface errors the same way
function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
    });
}

router.post("/auth", authLimiter, async (req, res) => {
    try {
        const userBarcode = req.body.barcode?.trim().replace(/[^\w\-]/g, ""); //sanitize input 

        //validate barcode checksum
        if (!utils.validatePatronBarcode(userBarcode)) {
            req.session.message = {
                type: "danger",
                text: AUTH_FAILED_MESSAGE,
            };
            return res.redirect("/");
        }

        // get user's Alma primary ID from scanned barcode
        const response = await axios.get(
            `${appConfig.AlmaAPI}/almaws/v1/users?limit=10&offset=0&q=identifiers~${encodeURIComponent(userBarcode)}&order_by=last_name%2C%20first_name%2C%20primary_id&expand=none&format=json`,
            {headers: { 'Authorization' : `apikey ${appConfig.API_KEY}` }}
        );

        //check number of results, make sure there is only one
        if (response.data.total_record_count !== 1) {
            // deliberately does not log the scanned barcode
            console.log(`[${new Date().toISOString()}] No single patron match for scanned barcode`);
            req.session.message = {
                type: "danger",
                text: AUTH_FAILED_MESSAGE,
            };
            return res.redirect("/");
        }

        // sample user if using Alma's sandbox API
        //if (response.data.total_record_count === 0) {
        //req.session.user_id = 'octavio.acevedo';

        const primaryId = response.data.user[0].primary_id;

        try {
            // Issue a brand new session ID before granting any authority, so a
            // session cookie that was already present cannot be escalated into
            // an authenticated one (session fixation).
            await regenerateSession(req);

            req.session.user_id = primaryId;
            req.session.authenticated = true;
            req.session.lastAction = Date.now();
            // anchors the absolute session cap enforced in index.js; no amount of
            // activity may extend a session past maxSessionLength from this moment
            req.session.loginTime = Date.now();

            await saveSession(req);
        } catch (sessionErr) {
            console.error(`[${new Date().toISOString()}] Session error during authentication: ${sessionErr.message}`);
            return res.status(500).send("Session error");
        }

        console.log(`[${new Date().toISOString()}] Patron authenticated successfully`);
        //redirect user to main page after authenticating 
        return res.redirect("/");

    } catch (err) {
        // Alma unreachable, or anything else unexpected. This previously read
        // `error.response.data` (a TypeError when there is no response) inside a
        // bare `catch {}` that referenced an undeclared `err`, throwing a
        // ReferenceError that Express 4 does not catch for async handlers -- so
        // no response was ever sent and the station hung until the client gave up.
        console.error(`[${new Date().toISOString()}] Error in /auth route: ${utils.describeApiError(err)}`);
        const mssgError = "API error. Please see the circulation desk.";
        return res.render("error", { mssgError });
    }
});

module.exports = router;
