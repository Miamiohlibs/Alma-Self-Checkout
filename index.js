const express = require("express");
require("dotenv").config();
const app = express();
const appConfig = require('./config/config'); 
const bodyParser = require("body-parser");
const authRoute = require('./routes/auth');
const checkoutRoute = require('./routes/checkout');
const patronRoute = require('./routes/patron');
const logoutRoute = require('./routes/logout');
const session = require("express-session");

const maxInactiveAge = appConfig.inactivityTimeout * 1000 * 60; 
const absoluteMaxAge = 10 * 60 * 1000; // 10 minutes

app.set('trust proxy', 1);

//logging for thorough debugging if needed
//app.use((req, res, next) => {
//  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
//  next();
//});

app.use(express.static("public"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
    session({
      secret: appConfig.session_secret, 
      resave: false,
      saveUninitialized: true,
      cookie: { 
        secure: false, // Set secure: true if using HTTPS
        maxAge: absoluteMaxAge, //set max session length
//        sameSite: "Lax",
     }, 
    })
  );

// inactivity middleware - checks last action time and resets cookie if necessary
app.use((req, res, next) => {
    
    // don't check session activity if user is not authenticated
    if (!req.session.authenticated) return next(); 

    const now = new Date().getTime();
    req.session.lastAction = req.session.lastAction || now; 
    const timeSinceLastAction = now - req.session.lastAction;

    if (timeSinceLastAction > maxInactiveAge) {
      return req.session.destroy(() => res.clearCookie('connect.sid').redirect('/'));
    }
    req.session.lastAction = now;
  
    // reset cookie maxAge at each request
    req.session.cookie.maxAge = absoluteMaxAge;
    next();
  });

app.use('/', authRoute);
app.use('/', checkoutRoute);
app.use('/', patronRoute);
app.use('/', logoutRoute);

app.set("view engine", "ejs");

// Start the server
app.listen(appConfig.port, () => {
  console.log(`Server is running on http://localhost:${appConfig.port}`);
});

module.exports = app;
