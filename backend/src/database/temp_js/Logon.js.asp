

window.onload = initWindow;

// If set that means that OTP was requested during logon routine.
var otpRequest = null;
var localeInfo = {};

function initWindow() {
    logonForm.userNameInput.focus();
    logonForm.passwordInput.focus();
    logonForm.userNameInput.focus();
}

function doLogon() {
    ///<summary>Handles client side of logon procedure.</summary>

    if (otpRequest) {
        submitOtp();
        return;
    }

    try {
        // Take ActiveX component by it's ID.
        var localeInfoProvider = localeinfoproviderObj;

        localeInfo.ShortDateFormat = localeInfoProvider.ShortDateFormat;
        localeInfo.Use12HourFormat = (localeInfoProvider.TimeFormat.indexOf("H") < 0);
        localeInfo.DecimalPoint = convertUnicodeSeparator(localeInfoProvider.DecimalPoint);
        localeInfo.ThousandSeparator = convertUnicodeSeparator(localeInfoProvider.ThousandSeparator);
        localeInfo.DigitsGrouping = localeInfoProvider.DigitsGrouping;
        localeInfo.DigitsAfterDecimal = new Number(localeInfoProvider.DigitsAfterDecimal);
    } catch (e) {
        // Failings related to LocaleInfoProvider are not critical and logon can proceed with them.
        Cast.Logging.logException(e, 'LocaleInfoProvider: ');
    }

    // Validate username and password.
    var username = logonForm.userNameInput.value.trim();
    var password = logonForm.passwordInput.value.trim();

    if (username.length === 0)
    {
        // Language must be explicitly provided here.
        alert("Please enter a user name.");
        logonForm.userNameInput.focus();
        return;
    }

    if (password.length === 0)
    {
        alert("Please enter a password.");
        logonForm.passwordInput.select();
        return;
    }

    try {
        $("#submitButton").prop("disabled", true);
        // Clear logon status.
        $("#logonStatus").text();
        var language = logonForm.languageSelect.value;

        // Obtain information about logon procedure.
        var logonParams = getLogonParams();

        if (logonParams.useAuthServer) {
            var passwordRequest = initializeTwoStepLogon(username);

            var encodedPassword = Cast.LoginPassword.encodePassword(
                password, passwordRequest.encodingType, passwordRequest.encodingParams);

            // The only case when something is returned here is when OTP is requested.
            otpRequest = finishTwoStepLogon( 
                passwordRequest.routineId, username, encodedPassword, passwordRequest.encodingType,
                passwordRequest.passwordRequestId, language, localeInfo);

            if (otpRequest) {
                // Show OTP field and hide all others to prevent changes in them.
                $("#logonStatus").text("One-time password is required.");
                $("#otpRow").show();
                $("#otpInput").focus();
                
                $("#userNameRow").hide();
                $("#passwordRow").hide();
                $("#languageRow").hide();

                $("#submitButton").prop("disabled", false);

                return;
            }
        } else {
            // Old logon process.
            doLogonWithoutAuthServer(username, password, language, localeInfo);
            $("#submitButton").prop("disabled", false);
        }
    }
    catch (error) {
        $("#submitButton").prop("disabled", false);
        processServerError(error);
    }
}

function submitOtp() {
    var oneTimePassword = $("#otpInput").val();

    if (oneTimePassword.length === 0) {
        alert("Please enter one-time password.");
        $("#otpInput").focus();
        return;
    }

    $("#submitButton").prop("disabled", true);

    var encodedPassword = Cast.LoginPassword.encodePassword(
        oneTimePassword, otpRequest.encodingType, otpRequest.encodingParams);
    
    var username = logonForm.userNameInput.value.trim();
    var language = logonForm.languageSelect.value;

    try {
        finishTwoStepLogon(
            otpRequest.routineId, username, encodedPassword, otpRequest.encodingType, otpRequest.passwordRequestId,
            language, localeInfo);
    } catch (error) {
        processServerError(error);

        // If OTP is incorrect logon routine ends and should be started again.
        otpRequest = null;

        $("#otpRow").hide();
        $("#userNameRow").show();
        $("#passwordRow").show();
        $("#languageRow").show();
        $("#otpInput").val("");
        $("#passwordInput").val("");
        $("#passwordInput").focus();
        $("#submitButton").prop("disabled", false);
    }
}

function getLogonParams() {
    var url = getControllerActionUrl("Logon", "Logon", "GetLogonParams");
    var result = Cast.RequestManager.postPageDataSync(url);

    return {
        useAuthServer: result.UseAuthServerForCastUsers
    };
}

function initializeTwoStepLogon(username) {
    var data = {
        Username: username
    };
    
    var url = getControllerActionUrl("Logon", "Logon", "InitializeTwoStepLogon");
    var result = Cast.RequestManager.postPageDataSync(url, data);
    
    return {
        routineId: result.RoutineId,
        passwordRequestId: result.PasswordRequest.Id,
        encodingType: result.PasswordRequest.EncodingType,
        encodingParams: result.PasswordRequest.EncodingParameters
    };
}

function finishTwoStepLogon(
    routineId, username, encodedPassword, encodingType, passwordRequestId, selectedLanguage, localeInfo) {
    
    var data = {
        RoutineId: routineId,
        Username: username,
        EncodedPassword: encodedPassword,
        EncodingType: encodingType,
        PasswordRequestId: passwordRequestId,
        SelectedLanguage: selectedLanguage,
        LocaleInfo: localeInfo
    };
    
    // If successful it leads to redirect to CastMain.
    // It also may lead to redirect to ExpiredPassword page or
    // when OTP is required it returns PasswordRequest.
    var url = getControllerActionUrl("Logon", "Logon", "FinishTwoStepLogon");
    var result = Cast.RequestManager.postPageDataSync(url, data);

    if (result && result.PasswordRequest) {
        return {
            routineId: result.RoutineId,
            passwordRequestId: result.PasswordRequest.Id,
            encodingType: result.PasswordRequest.EncodingType,
            encodingParams: result.PasswordRequest.EncodingParameters
        };
    }
    return null;
}

function doLogonWithoutAuthServer(username, password, selectedLanguage, localeInfo) {
    var data = {
        Username: username,
        Password: password,
        SelectedLanguage: selectedLanguage,
        ScreenWidth: window.screen.availWidth,
        ScreenHeight: window.screen.availHeight,
        LocaleInfo: localeInfo
    };
    
    // If successful it leads to redirect to CastMain.
    // It also may lead to redirect to ExpiredPassword page.
    var url = getControllerActionUrl("Logon", "Logon", "DoLogonWithoutAuthServer");
    return Cast.RequestManager.postPageDataSync(url, data);
}

function processServerError(error) {
    if (!(error instanceof Cast.ServiceError))
    {
        // Only if error is not result of ServiceException then it is an actual exception that must be logged as such.
        $("#logonStatus").text("An unexpected error occurred while processing the request. Contact CQG customer support for assistance.");
        Cast.Logging.logException(error);
        return;
    }
    
    var translatedMessage = null;
    
    // Error code corresponds to code of ErrorDescriptor that came from the server.
    switch (error.errorCode) {
        case 1001: // SessionError.InvalidUserNamePassword
            translatedMessage = "Logon failed.  Please try again";
            break;

        case 1003: // SessionError.ProductAccessDisabled
            translatedMessage = "Given login is not enabled to use CAST. Contact CQG Customer Support.";
            break;

        case 1014: // SessionError.UserIsLockedOut
            translatedMessage = "User is locked out.";
            break;
        
        case 1015: // SessionError.DisallowedIpAddress
            translatedMessage = "Logon failed. Connection request from IP address is not allowed";
            break;

        case 1020: // SessionError.TooFrequentLogonAttempts
            translatedMessage = "Too frequent logon attempts.";
            break;

        case 2051: // CommonError.AntiForgeryTokenValidationError
            translatedMessage = "Application parameters have been modified. Please press F5 or click the Refresh Button.";
            break;

        default:
    }

    // If corresponding translation is not available show error message as it is.
    $("#logonStatus").html(translatedMessage || error.message);
}

function UNIKeyPress() {
    // 13 is Enter, 9 is Tab.
    if (event.keyCode === 13 || event.keyCode === 9) {
        logonForm.passwordInput.select();
        return false;
    }
    return undefined;
}

function convertUnicodeSeparator(char) {
    // 160 is nbsp.
    if (char.charCodeAt(0) === 160) {
        return " ";
    }
    else {
        return char.charAt(0);
    }
}