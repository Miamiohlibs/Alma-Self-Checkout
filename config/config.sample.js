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
    barcode_format: '', // your library's item barcode format, used for validation: 'luhn','modulo43', or 'none'
    inactivityTimeout: 2, // in minutes; maximum inactivity length
    maxSessionLength: 10, // in minutes; maximum session length since last transaction, regardless of activity (do not set too low)
    port: 3000,
    session_secret: '', // set unique secret for session cookie
};

module.exports = appConfig;
