const appConfig = {
    institutionDetails: {
      welcomeMessage: 'Touch screen then tap your ID to begin', // text displayed on screen when logged out
      brandingImg: 'img/logo.png', // relative path to your institution's logo
      imgAltText: 'University Libraries', // alt text for your logo
    },
    AlmaAPI: '', // See https://developers.exlibrisgroup.com/alma/apis/#calling
    API_KEY: '', // See https://developers.exlibrisgroup.com/manage/keys/
    alma_circ_desk: '', // See https://developers.exlibrisgroup.com/alma/apis/docs/xsd/rest_item_loan.xsd/#item_loan
    alma_library: '', // See https://developers.exlibrisgroup.com/alma/apis/docs/xsd/rest_item_loan.xsd/#item_loan
    barcode_format: 'none', // your library's item barcode format, used for validation: 'luhn','modulo43', or 'none'
    inactivityTimeout: 1, // in minutes; maximum inactivity length
    maxSessionLength: 10, // in minutes; absolute session ceiling, regardless of activity (do not set too low)
    port: 3000,
    bindAddress: '127.0.0.1', // interface to listen on; leave as loopback unless the browser runs on another host
    sessionHost: '127.0.0.1:11211', // host and port for memcached server
    sessionSecret: '', // secret for session cookie
    sessionStoreSecret: '', //secret for memcached store
};

module.exports = appConfig;
