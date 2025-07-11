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
const helmet = require('helmet');

const MemcachedStore = require('connect-memcached')(session); 

const maxInactiveAge = appConfig.inactivityTimeout * 1000 * 60; //inactivity limit
const absoluteMaxAge = 10 * 60 * 1000; // maximum session length for cookie (10 minutes)

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net", 
        "https://fonts.googleapis.com",
        "https://unpkg.com",
        ],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "no-referrer" },
  frameguard: { action: "deny" },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  hidePoweredBy: true,
}));


app.set('trust proxy', 1);

//log all http requests for debugging (could be voluminous, consider disabling if not needed)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.static("public"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: appConfig.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new MemcachedStore({
    hosts: [appConfig.sessionHost],
    secret: appConfig.sessionStoreSecret
  }),
  cookie: {
    maxAge: maxInactiveAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }
}));

// inactivity middleware - checks last action time and resets cookie on each transaction if necessary
app.use((req, res, next) => {
  // don't check session activity if user is not authenticated
  if (!req.session.authenticated) {
    return next()
};

  // calculate time since last interaction
  const now = new Date().getTime();
  req.session.lastAction = req.session.lastAction || now;
  const timeSinceLastAction = now - req.session.lastAction;

  //if more than the designated time period has passed, destroy the session
  if (timeSinceLastAction > maxInactiveAge) {
    return req.session.destroy(() => res.clearCookie('connect.sid').redirect('/'));
  }

  //update time of last action and reset cookie
  req.session.lastAction = now;
  req.session.cookie.maxAge = absoluteMaxAge;

  next();
});  

app.use('/', authRoute);
app.use('/', checkoutRoute);
app.use('/', patronRoute);
app.use('/', logoutRoute);


app.post('/keepalive', (req, res) => {
  if (req.session) {
    // No need to call req.session.touch() here, middleware handles it
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

app.set("view engine", "ejs");

// Start the server
app.listen(appConfig.port, () => {
  console.log(`Server is running on http://localhost:${appConfig.port}`);
});

module.exports = app;
