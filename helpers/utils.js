const appConfig = require('../config/config');
const luhn = require("luhn");

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
    // make sure it only has numbers and letters
    return /^[A-Za-z0-9]+$/.test(str);
}


module.exports = {
    validateItemBarcode,
    validatePatronBarcode
};