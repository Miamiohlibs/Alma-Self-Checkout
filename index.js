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
// absolute ceiling on a session: activity extends the inactivity window but can
// never push a session past this, so a station that is never left truly idle
// still returns to the welcome screen. Defaults to 10 minutes when unset.
const maxSessionLength = (appConfig.maxSessionLength || 10) * 1000 * 60;

// A scanned barcode is the only credential here, so the station must not be
// reachable from the wider network. Defaults to loopback; set bindAddress in
// config.js only if the browser runs on a different host than this server.
const bindAddress = appConfig.bindAddress || '127.0.0.1';

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
    secret: appConfig.sessionStoreSecret,
  }),
  cookie: {
    maxAge: maxSessionLength,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }
}));


// tear down an expired session. Background pings get a 401 so the page can react;
// ordinary navigation gets sent back to the welcome screen.
function endSession(req, res, reason) {
  const isBackgroundPing = req.path === '/keepalive';
  console.log(`[Session] ${reason}. Destroying session.`);
  return req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return isBackgroundPing ? res.sendStatus(401) : res.redirect('/');
  });
}

// session lifetime middleware - enforces the inactivity window and the absolute
// session cap on every authenticated request, /keepalive included.
app.use((req, res, next) => {
  // don't check session activity if user is not authenticated
  if (!req.session.authenticated) {
    return next();
  }

  const now = Date.now();
  req.session.lastAction = req.session.lastAction || now;
  req.session.loginTime = req.session.loginTime || now;

  const timeSinceLastAction = now - req.session.lastAction;
  const sessionAge = now - req.session.loginTime;

  console.log(`[Session] age: ${sessionAge}/${maxSessionLength}, idle: ${timeSinceLastAction}/${maxInactiveAge}`);

  // the absolute cap is checked first: activity must not be able to defer it
  if (sessionAge > maxSessionLength) {
    return endSession(req, res, 'Maximum session length reached');
  }

  //if more than the designated time period has passed, destroy the session
  if (timeSinceLastAction > maxInactiveAge) {
    return endSession(req, res, 'Inactivity timeout reached');
  }

  //update time of last action
  req.session.lastAction = now;
  // keep the cookie's own lifetime tied to what remains of the absolute cap, so
  // a surviving cookie can never outlive the session it refers to
  req.session.cookie.maxAge = maxSessionLength - sessionAge;

  next();
});  

// Registered AFTER the middleware above on purpose. When this sat in front of
// it, a ping refreshed lastAction with no timeout check and no authentication
// check, which let a walked-away session be revived indefinitely.
app.post('/keepalive', (req, res) => {
  if (!req.session.authenticated) {
    return res.sendStatus(401);
  }
  // reaching here means the middleware already validated and refreshed the session
  return res.sendStatus(200);
});

app.use('/', authRoute);
app.use('/', checkoutRoute);
app.use('/', patronRoute);
app.use('/', logoutRoute);



app.set("view engine", "ejs");

// Start the server
app.listen(appConfig.port, bindAddress, () => {
  console.log(`Server is running on http://${bindAddress}:${appConfig.port}`);
});

module.exports = app;
