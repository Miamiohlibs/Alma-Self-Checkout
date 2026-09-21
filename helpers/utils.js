const appConfig = require('../config/config');
const luhn = require("luhn");

// upper bound on any scanned barcode; mirrors the maxlength on the scan inputs
// so an oversized value can't be pushed straight into an Alma API URL
const MAX_BARCODE_LENGTH = 64;

// common shape check for anything arriving from a scanner: a non-empty string
// of a sane length. Without this a missing form field reaches the validators as
// undefined, which the regexes below coerce to the string "undefined" and pass.
function isScannableString(value) {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= MAX_BARCODE_LENGTH
    );
}

//function for validating modulo43 barcodes
function validateModulo43(barcode) {

    // possible valid characters in code 39 barcodes
    const code39chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. *$/+%";

    if (barcode.length <= 1) {
        return false;
    }

    // get last character (checksum character)
    const actualChecksumChar = barcode.charAt(barcode.length - 1);

    // calculate expected checksum value
    let checksumTotal = 0;
    for (let i = 0; i < barcode.length - 1; i++) {
        const character = barcode.charAt(i).toUpperCase();
        const characterValue = code39chars.indexOf(character);
        if (characterValue === -1) {
            return false;
        }
        checksumTotal += characterValue;
    }
    const calculatedChecksumChar = code39chars.charAt(checksumTotal % 43);

    // compare actual checksum and calculated checksum
    return actualChecksumChar.toUpperCase() === calculatedChecksumChar;
}


//validate item barcodes when checking out
function validateItemBarcode(barcode) {
    if (!isScannableString(barcode)) {
        return false;
    }
    if (appConfig.barcode_format == 'luhn') {
        return luhn.validate(barcode);
    } else if (appConfig.barcode_format == 'modulo43') {
        return validateModulo43(barcode);
    }
    //if no barcode format is set, perform generic validation (accept numbers and letters only)
    else {
        return /^[A-Za-z0-9]+$/.test(barcode);
    }
}

// validate patron's barcode
function validatePatronBarcode(str) {
    if (!isScannableString(str)) {
        return false;
    }
    // make sure it only has numbers and letters
    return /^[A-Za-z0-9]+$/.test(str);
}

// Build a log-safe description of an Alma API failure.
// axios attaches the full request config to its error objects, including the
// Authorization header (our Alma API key) and the query string (the patron's
// barcode), and console.log/util.inspect prints all of it. So never log an
// axios error directly -- log this instead.
function describeApiError(error) {
    if (error.response) {
        const almaErrors = error.response.data?.errorList?.error || [];
        // Error CODES only. Alma's free-text errorMessage routinely quotes the
        // value that was looked up -- a patron identifier or an item barcode --
        // and circulation records must not land in application logs. Codes are
        // documented by Ex Libris, so they remain enough to diagnose a failure.
        const codes = almaErrors
            .map((e) => e.errorCode)
            .filter(Boolean)
            .join(", ");
        return `Alma API returned HTTP ${error.response.status}${codes ? ` (Alma error ${codes})` : ""}`;
    }
    // no response: this is our own transport/runtime error, which carries no
    // patron data, so the message is safe and worth keeping for diagnosis
    return `Alma API request failed: ${error.code || error.message}`;
}


module.exports = {
    validateItemBarcode,
    validatePatronBarcode,
    describeApiError,
    MAX_BARCODE_LENGTH
};
