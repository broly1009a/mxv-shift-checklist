/*
    Dependencies: jQuery, json2.js
*/

(function ()
{
    var CLIENT_RESULT = {
        SUCCESS: 1,
        FAIL: 2,
        REDIRECT: 3
    };

    var REQUEST_VERIFICATION_TOKEN_HEADER = "__RequestVerificationToken";

    function RequestManager()
    {
        /// <summary>Manages page requests.</summary>

        this._pageRequests = [];

        this._initialize();
    }

    RequestManager.prototype.abortPageRequests = function ()
    {
        /// <summary>Aborts all active page requests.</summary>

        this._pageRequests.forEach(function (e)
        {
            // We need to abort requests safely, because a request's "fail" callback could potentially throw unhandled exception.
            try
            {
                e.abort();
            }
            catch (e) { }
        });
        this._pageRequests = [];
    };

    RequestManager.prototype.postPageData = function (url, data)
    {
        /// <summary>Asynchronously posts page json data to the server and expects json response.</summary>
        /// <param name="url" type="String">Url to post data.</param>
        /// <param name="data" type="Object">Object data that will be posted.</param>

        return new Promise(function(resolve, reject) {
            postPageDataInternal(true, url, data, resolve, reject);
        });
    };

    RequestManager.prototype.postPageDataSync = function(url, data)
    {
        /// <summary>Synchronously posts page json data to the server and expects json response.</summary>
        /// <param name="url" type="String">Url to post data.</param>
        /// <param name="data" type="Object">Object data that will be posted.</param>
        /// <returns type="Object">Data object if request is successful.</returns>

        var onSuccess = function(data) { return data; };
        var onFail = function(error) { throw error; };
        return postPageDataInternal(false, url, data, onSuccess, onFail);
    };

    RequestManager.prototype.loadPageHtmlAsync = function (url, data)
    {
        /// <summary>Asynchronously posts page json data to the server and expects html response.</summary>

        var request = postJsonData({
            url: url,
            data: JSON.stringify(data),
            metadata: { isPageRequest: true },
            dataType: "html"
        });

        return new Promise(function(resolve, reject)
        {
            request
                .done(function(data) { resolve(data); })
                .fail(function(xhr, textStatus)
                {
                    // Do not treate aborted request as error.
                    if (isAbortedRequest(textStatus))
                    {
                        return;
                    }

                    reject(new Cast.NetworkError(url, xhr.responseText));
                });
        });
    };

    RequestManager.prototype._initialize = function ()
    {
        /// <summary>Initializes the request manager.</summary>

        var me = this;
        var jDocument = $(document);

        // Track active page requests.
        jDocument.ajaxSend(function (event, xhr, settings)
        {
            // Store only page requests.
            if (settings.metadata && settings.metadata.isPageRequest)
            {
                me._pageRequests.push(xhr);
            }
        });

        jDocument.ajaxComplete(function (event, xhr, settings)
        {
            me._pageRequests = me._pageRequests.filter(function (e) { return e != xhr; });
        });
    };

    function postPageDataInternal(isAsync, url, data, onSuccess, onFail)
    {
        var request = postJsonData({
            url: Cast.Url.content(url),
            data: JSON.stringify(data),
            dataType: "json",       // "json" is expected as response data type
            async: isAsync
        });

        // Define handlers for each client result operation status.
        var handlers = {};
        handlers[CLIENT_RESULT.SUCCESS] = function (result)
        {
            return onSuccess(result.Data);
        };

        handlers[CLIENT_RESULT.FAIL] = function (result)
        {
            return onFail(new Cast.ServiceError(result.ErrorMessage, result.Error.Code, result.Error));
        };

        handlers[CLIENT_RESULT.REDIRECT] = function (result)
        {
            // If TopWindow does not exist it means that we are on logon pages.
            if (Cast.TopWindow) {
                Cast.TopWindow.location.replace(result.RedirectUrl);
            } else {
                window.location.replace(result.RedirectUrl);
            }
        };

        // Register handlers.
        if (isAsync)
        {
            request.done(function (result) { handlers[result.Status](result); });
            request.fail(function(xhr, textStatus, error)
            {
                // Do not treat aborted request as error.
                if (isAbortedRequest(textStatus))
                {
                    return;
                }

                var errorMessage = xhr.responseText;

                if (error && error.message) {
                    errorMessage += "\n" + error.message;
                }
                onFail(new Cast.NetworkError(url, errorMessage));
            });

            return request;
        }
        else
        {
            if (request.status < 200 || request.status >= 300)
            {
                onFail(new Cast.NetworkError(url, request.responseText));
            }

            var result = JSON.parse(request.responseText);
            return handlers[result.Status](result);
        }
    }

    function postJsonData(customOptions)
    {
        ///<summary>Posts JSON data to server. Async method.</summary>
        /// <param name="customOptions" type="Object">Object with jQuery ajax options.</param>

        var options = $.extend({
            url: null,              // An url shall be provided in custom options.
            headers: addTokenToRequestHeaders(),
            type: "POST",
            contentType: "application/json; charset=utf-8",
            metadata: { isPageRequest: true }
        }, customOptions);

        return $.ajax(options);
    }

    function isAbortedRequest(textStatus)
    {
        return textStatus === "abort";
    }

    function addTokenToRequestHeaders()
    {
        // If you are changing this method, make sure that similar method `getCSRFtoken` in CastLogging.js file is working.
        var headers = {};

        // RequestVerificationToken hidden input is injected in html pages from PageLayout.html.
        var token = $("[name=__RequestVerificationToken]").val();
        if (token != null)
        {
            // Put token into headers.
            headers[REQUEST_VERIFICATION_TOKEN_HEADER] = token;
        }
        else if (Cast.TopWindow && Cast.TopWindow.masthead && Cast.TopWindow.masthead.document
            && Cast.TopWindow.masthead.document.getElementById("CSRFtoken"))
        {
            // CSRFtoken hidden input is injected in masthead.asp page.
            var csrfToken = Cast.TopWindow.masthead.document.getElementById("CSRFtoken").value;
            if (csrfToken != null)
            {
                headers[REQUEST_VERIFICATION_TOKEN_HEADER] = csrfToken;
            }
        }
        else if (window.document.getElementById("CSRFtoken"))
        {
            // CSRFtoken hidden input is injected in logon.asp page.
            var csrfToken = window.document.getElementById("CSRFtoken").value;
            if (csrfToken != null)
            {
                headers[REQUEST_VERIFICATION_TOKEN_HEADER] = csrfToken;
            }
        }
        return headers;
    }

    // Define single instance of the RequestManager class.
    if (!window.Cast)
    {
        window.Cast = {};
    }

    window.Cast.RequestManager = new RequestManager();

})();
;
(function()
{
    // Create namespace for Cast objects.
    if (!window.Cast)
    {
        window.Cast = {};
    }

    var cast = window.Cast;

    window.DECLARE = function(namespaceName, className, thisClass, baseClass)
    {
        /// <summary>Declare class in the specified namespace.</summary>
        /// <param name="namespaceName" type="string">Javascript namespace name (e.g. "Cast.Controls") where new class will be added.</param>
        /// <param name="className" type="string">Class name (e.g. "Checkbox").</param>
        /// <param name="thisClass" type="function">Class to declare.</param>
        /// <param name="baseClass" type="function" optional="true">Base class.</param>

        cast.getNamespace(namespaceName)[className] = thisClass;

        if (baseClass)
        {
            EXTEND(thisClass, baseClass);
        }
    };

    window.EXTEND = function(thisClass, baseClass)
    {
        /// <summary>Makes class inherited from base class.</summary>
        /// <param name="thisClass" type="function">Class to extend.</param>
        /// <param name="baseClass" type="function">Base class.</param>

        var F = function()
        {
        };
        F.prototype = baseClass.prototype;
        thisClass.prototype = new F();
        thisClass.prototype.constructor = thisClass;
    };

    cast.getNamespace = function(namespaceName)
    {
        /// <summary>Creates JavaScript namespace if not exists and returns namespace object.</summary>
        /// <param name="namespaceName">Namespace name (e.g. 'Cast.Controls').</param>
        /// <returns>JavaScript namespace object.</returns>

        var names = namespaceName.split(".");
        var current = window;

        for (var i = 0; i < names.length; ++i)
        {
            var name = names[i];

            if (current[name] == undefined)
            {
                current[name] = {};
            }

            current = current[name];
        }

        return current;
    };

})();
;
/*.
    Dependencies: CastDeclare.js
*/
(function()
{
    var ALLOWED_TO_TRADE = {
        ALLOWED: "1",
        NOT_ALLOWED: "0",
        DEFAULT: "-2"
    };

    // Predefined limit modes.
    var LIMIT_MODE = {
        UNLIMITED: "unlimited",
        LIMITED: "limited",
        DEFAULT: "default"
    };

    // Possible data format types.
    var DATA_TYPE = {
        INT: "int",
        FLOAT: "float",
        DECIMAL: "decimal"
    };

    var RISK_PARAMETER_FLOAT_PRECISION = 4;
    var RISK_PARAMETER_FLOAT_MIN_VALUE = 0.0001;

    // Margin multiplier parameters.
    var MARGIN_MULTIPLIER = {
        PRECISION: 3,
        MIN_VALUE: 0.001,
        MAX_VALUE: 100
    };

    var MAX_PP = {
        PRECISION: 3,
        MIN_VALUE: 0.001,
        MAX_VALUE: 9999999999.0
    }

    var DECIMAL_VALUE = {
        PRECISION: 12,
        MIN_VALUE: 0.0,
        MAX_VALUE: 9999999999999999.999999999999
    }

    var OMNIBUS_SUPPORT_TYPE = {
        PROHIBITED: 1,
        ALLOWED: 2,
        REQUIRED: 3
    };

    var USER_SCOPE = {
        GW_ADMIN: 1,
        FCM: 2,
        SALES_REP: 3
    };

    var TRADER_CLASS = {
        REGULAR: 1,
        ORDER_HANDLER: 2,
        MESSENGER_PLUGIN: 3,
        TEMPLATE: 4
    };

    // List of Gateway entity types.
    // The list shall be synchronized with corresponded object in Global.inc and GatewayEntityType.cs enum.
    var ENTITY_TYPE = {
        CUSTOMER: 1,
        ACCOUNT: 2,
        TRADER: 3,
        ROUTE_GROUP: 4,
        EXECUTION_SYSTEM_ROUTE: 5,
        FCM: 6,
        METADATA_EXCHANGE: 7,
        SALES_SERIES: 8,
        CONTRACT: 9,
        CAST_USER: 10,
        ROUTE: 11
    };

    var CUSTOMER_TYPE = {
        INDIVIDUAL: 1,
        JOINT: 2,
        LIMITED: 3,
        TRUST: 4,
        CORPORATE: 5,
        PARTNERSHIP : 6
    };

    var CONTRIBUTOR_AUTHORIZATION_LEVEL = {
        NONE: 0,
        ONE_REQUIRED: 1,
        ANY_REQUIRED: 2
    };

    // Must be consistent with OrderOperationType enum.
    var ORDER_OPERATION_TYPE = {
        CANCEL: 1,
        REFLECT_AS_CANCELED: 2
    };

    DECLARE("Cast.Constants", "ALLOWED_TO_TRADE", ALLOWED_TO_TRADE);
    DECLARE("Cast.Constants", "LIMIT_MODE", LIMIT_MODE);
    DECLARE("Cast.Constants", "DATA_TYPE", DATA_TYPE);
    DECLARE("Cast.Constants", "RISK_PARAMETER_FLOAT_PRECISION", RISK_PARAMETER_FLOAT_PRECISION);
    DECLARE("Cast.Constants", "RISK_PARAMETER_FLOAT_MIN_VALUE", RISK_PARAMETER_FLOAT_MIN_VALUE);
    DECLARE("Cast.Constants", "MARGIN_MULTIPLIER", MARGIN_MULTIPLIER);
    DECLARE("Cast.Constants", "MAX_PP", MAX_PP);
    DECLARE("Cast.Constants", "OMNIBUS_SUPPORT_TYPE", OMNIBUS_SUPPORT_TYPE);
    DECLARE("Cast.Constants", "USER_SCOPE", USER_SCOPE);
    DECLARE("Cast.Constants", "TRADER_CLASS", TRADER_CLASS);
    DECLARE("Cast.Constants", "ENTITY_TYPE", ENTITY_TYPE);
    DECLARE("Cast.Constants", "CUSTOMER_TYPE", CUSTOMER_TYPE);
    DECLARE("Cast.Constants", "CONTRIBUTOR_AUTHORIZATION_LEVEL", CONTRIBUTOR_AUTHORIZATION_LEVEL);
    DECLARE("Cast.Constants", "DECIMAL_VALUE", DECIMAL_VALUE);
    DECLARE("Cast.Constants", "ORDER_OPERATION_TYPE", ORDER_OPERATION_TYPE);
})();
;
(function()
{
    var Logging = Cast.getNamespace("Cast.Logging");
    var ErrorHandling = Cast.getNamespace("Cast.ErrorHandling");

    ErrorHandling.redirectToErrorScreen = function()
    {
        /// <summary>Redirects user to error screen.</summary>

        window.location = Cast.Configuration.UnexpectedErrorUrl;
    };

    ErrorHandling.onErrorHandler = function(message, url, lineNumber)
    {
        /// <summary>JavaScript error handler.</summary>
        /// <param name="message" type="string">JavaScript error message.</param>
        /// <param name="url" type="string">Resource url where a JavaScript error was occured.</param>
        /// <param name="lineNumber" type="int">Line number where a JavaScript error was occured.</param>
        /// <returns type="boolean">Returns false to let browser to show a default error dialog.</returns>

        Logging.logException({ message: message, fileName: url, lineNumber: lineNumber });
    };

    Logging.logException = function(e, messagePrefix)
    {
        /// <summary>Logs JavaScript exception.</summary>
        /// <param name="e" type="Error">Exception to log.</param>

        var errorInfo = {
            pageUrl: document.URL,
            message: (messagePrefix || '') + e.message,
            url: e.fileName || document.URL,
            lineNumber: e.lineNumber
        };

        try
        {
            console.error(e);
        }
        catch (exception)
        {
            // Can't handle problems with console.error.
        }

        try
        {
            // Post data.
            var xhr = new XMLHttpRequest();
            xhr.open("POST", Cast.Configuration.LoggerUrl, true);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.setRequestHeader("Accept", "application/json");
            xhr.setRequestHeader("__RequestVerificationToken", getCSRFtoken());
            xhr.send(getFormUrlEncodedData(errorInfo));
        }
        catch (exception)
        {
            // If logging failed we can't handle it.
        }
    };

    Logging.logErrorMessage = function(message)
    {
        /// <summary>Logs error message.</summary>
        /// <param name="message" type="string">Message to log.</param>

        Logging.logException({ message: message });
    };

    function getFormUrlEncodedData(obj)
    {
        var args = [];
        for (var name in obj)
        {
            var value = obj[name];
            if (obj.hasOwnProperty(name) && typeof value != "undefined")
            {
                args.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
            }
        }
        return args.join("&");
    }

    function getCSRFtoken()
    {
        // If you are changing this method, make sure that similar method `addTokenToRequestHeaders` in RequestManager.js file is working.
        // RequestVerificationToken hidden input is injected in html pages from PageLayout.html.
        var token = $("[name=__RequestVerificationToken]").val();
        if (token != null)
        {
            return token;
        }

        if (Cast.TopWindow && Cast.TopWindow.masthead && Cast.TopWindow.masthead.document
            && Cast.TopWindow.masthead.document.getElementById("CSRFtoken"))
        {
            // CSRFtoken hidden input is injected in masthead.asp page.
            var csrfToken = Cast.TopWindow.masthead.document.getElementById("CSRFtoken").value;
            if (csrfToken != null)
            {
                return csrfToken;
            }
        }

        if (window.document.getElementById("CSRFtoken"))
        {
            // CSRFtoken hidden input is injected in logon.asp page.
            var csrfToken = window.document.getElementById("CSRFtoken").value;
            if (csrfToken != null)
            {
                return csrfToken;
            }
        }

        return null;
    }
})();
;
/*
    CAST JavaScript objects.
    Dependencies: jQuery, json2.js, js.cookie, RequestManager.js, CastConstants.js, CastDeclare.js
*/

(function()
{
    var cast = window.Cast;

    var DATA_OLD_ATTR = "data-old";

    var DATA_TYPE = Cast.Constants.DATA_TYPE;

    // Scopes of CAST user.
    cast.FCM_SCOPE = 2;
    cast.SR_SCOPE = 3;

    // Maximum Int32 value.
    cast.MAX_INT = 2147483647;

    // Commodity type.
    cast.CommodityType = {
        NonUs: 0,
        Us: 1
    };

    // Limit state.
    cast.LimitState = {
        Unlimited: -1,
        Default: -2
    };

    // Cast hosted page events.
    cast.events = {
        pageExpired: "PageExpired",
        pageChanged: "PageChanged",
        pageChangedByKey: "PageChangedByKey",
        pageReverted: "PageReverted"
    };

    cast.attachEventHandler = function(name, handler)
    {
        /// <summary>Attach event handler.</summary>
        /// <param name="name" type="string">Event name.</param>
        /// <param name="handler" type="function">Event handler.</param>

        getEventsContainer().bind(name, handler);
    };

    cast.detachEventHandler = function(name, handler)
    {
        /// <summary>
        /// Detach handlers from specified event.
        /// </summary>
        /// <param name="name" type="string">Event name.</param>
        /// <param name="handler" type="function" optional="true">
        /// Event handler. If handler is not specified then all handlers for event will be detached.
        /// </param>

        getEventsContainer().unbind(name, handler);
    };

    cast.raiseEvent = function(name, eventParameters)
    {
        /// <summary>Raises specified event.</summary>
        /// <param name="name" type="string">Event name.</param>
        /// <param name="eventParameters" type="Array" optional="true">
        /// Array of Additional parameters to pass along to the event handler.
        /// </param>

        getEventsContainer().trigger(name, eventParameters);
    };

    function getEventsContainer()
    {
        // All Cast events we bind to page container.
        return $("#xmlContainer");
    }

    cast.hideButtons = function()
    {
        $("#refreshButton").hide();
        $("#saveButton").hide();
    };

    cast.showButtons = function()
    {
        $("#refreshButton").show();
        $("#saveButton").show();
    };

    cast.enableSaveButton = function()
    {
        /// <summary>Enables the save button.</summary>

        $("#saveButton").removeAttr("disabled");
    };

    cast.isSaveButtonDisabled = function () {
        /// <summary>Check if save button is disabled.</summary>

        return $("#saveButton").prop('disabled');
    };

    cast.disableSaveButton = function()
    {
        /// <summary>Enables the save button.</summary>

        $("#saveButton").prop("disabled", true);
    };

    cast.hideSaveButton = function ()
    {
        /// <summary>Hides the save button.</summary>

        $("#saveButton").hide();
    };

    cast.clearStatusBar = function()
    {
        /// <summary>Clears status bar text.</summary>

        $("#statusBar").text("");
    };

    cast.toggleAttribute = function(element, attribute, switchState, value)
    {
        /// <summary>
        /// Add/remove attribute of jquery element depending on given switchState or current state.
        /// </summary>
        /// <param name="element" type="jQuery element">jQquery element.</param>
        /// <param name="attribute" type="string">Name of the attribute to toggle.</param>
        /// <param name="switchState" type="boolean" optional="true">
        /// A boolean value to determine whether the attribute should be added or removed.
        /// </param>
        /// <param name="value" type="string" optional="true">
        /// A value that should be set as value of an attribute.
        /// </param>

        value = value || attribute;

        element.each(function()
        {
            var e = $(this);
            var newState = (switchState != undefined) ? switchState : !e.is("[" + attribute + "]");

            if (newState)
            {
                e.attr(attribute, value);
            }
            else
            {
                e.removeAttr(attribute);
            }
        });
    };

    cast.setAttribute = function(element, attribute, isSet)
    {
        /// <summary>Adds/removes attribute of jQuery element depending on the given set flag.</summary>
        /// <param name="element" type="jQuery">jQuery element.</param>
        /// <param name="attribute" type="Attribute">Instance of the Attribute class.</param>
        /// <param name="isSet" type="boolean" optional="true">
        /// A boolean value to determine whether the attribute should be added or removed.
        /// If not specified then attribute will be added.
        /// </param>

        if (isSet === undefined)
        {
            isSet = true;
        }

        if (isSet)
        {
            element.attr(attribute.name, attribute.value);
        }
        else
        {
            element.removeAttr(attribute.name);
        }
    };

    cast.toggleDisabledAttribute = function(jQueryElement, switchState)
    {
        /// <summary>
        /// Add or remove disabled="disabled" attribute from each element in given jQuery object.
        /// </summary>
        /// <param name="jQueryElement" type="jQuery">jQuery object with HTML elements.</param>
        /// <param name="switchState" type="boolean" optional="true">
        /// A boolean value to determine whether the attribute should be added or removed.
        /// </param>
        /// <remarks>This function is similar to jQuery.toggleClass() function.</remarks>

        cast.toggleAttribute(jQueryElement, "disabled", switchState);
    };

    cast.isChecked = function(jQueryElement)
    {
        /// <summary>
        /// Gets a value indicating whether the element is checked.
        /// </summary>
        /// <param name="jQueryElement" type="jQuery">jQuery object with HTML elements.</param>
        /// <returns type="boolean">A value indicating whether the control is checked.</returns>

        return jQueryElement.is(":checked");
    };

    cast.serializeToJson = function(data)
    {
        ///<summary>Return specified data object represented as JSON string.</summary>

        return JSON.stringify(data);
    };

    cast.deserializeFromJson = function(json)
    {
        ///<summary>Deserializes object from give json string.</summary>
        /// <param name="json" type="string">JSON string.</param>

        return JSON.parse(json);
    };

    cast.typeOf = function(obj)
    {
        /// <summary>Gets type of the object.</summary>
        /// <returns type="string">Type of the object.</returns>
        /// <remarks>This function works properly only for native javascript objects.</remarks>
        /// <remarks>Examples of return values: "Object", "Array", etc.</remarks>

        return Object.prototype.toString.call(obj).match(/^\[object (.*)\]$/)[1];
    };

    cast.deserializeServerObjectFromJson = function(json)
    {
        /// <summary>Deserializes given json string and rename objects according to JavaScript naming convention.</summary>
        /// <param name="json" type="string">JSON string.</param>
        /// <returns type="object">Deserialized and processed object.</returns>

        return cast.renameServerObject(cast.deserializeFromJson(json));
    };

    cast.renameServerObject = function(obj)
    {
        /// <summary>
        /// Recursively itereates through the given object and renames its properties
        /// according to the JavaScript naming convention.
        /// </summary>

        for (var property in obj)
        {
            var newProperty = property.lowerCaseFirst();

            if (newProperty != property)
            {
                obj[newProperty] = obj[property];
                delete obj[property];
            }

            var type = cast.typeOf(obj[newProperty]);

            if (type == "Object" || type == "Array")
            {
                cast.renameServerObject(obj[newProperty]);
            }
        }

        return obj;
    };

    cast.isValidNumber = function (obj, minValue, maxValue)
    {
        if (Cast.isNullOrEmpty(obj))
        {
            return true;
        }

        if (!obj.toString().match(/^\s*\d+\s*$/))
        {
            return false;
        }

        var value = parseInt(obj, 10);
        var result = true;

        if (minValue !== undefined && minValue !== null)
        {
            result = value >= minValue;
        }

        if (maxValue !== undefined && maxValue !== null)
        {
            result = result && value <= maxValue;
        }
        return result;
    };

    cast.isNumber = function(params)
    {
        /// <summary>Checks whether given values are numbers (NaN is also treated as a number).</summary>
        /// <returns type="Boolean">True if all given values are numbers; otherwise - false.</returns>

        if (arguments.length == 0)
        {
            return false;
        }

        for (var i = 0; i < arguments.length; i++)
        {
            if (!_.isNumber(arguments[i]))
            {
                return false;
            }
        }

        return true;
    };

    cast.isInteger = function(number)
    {
        /// <summary>Checks whether the given value is an integer number (NaN is also treated as a number).</summary>

        return cast.isNumber(number) && (number % 1 === 0);
    };

    cast.getNumberPrecision = function(number)
    {
        /// <summary>Gets number precision.</summary>
        /// <param name="number" type="Number">Number.</param>

        if (!cast.isNumber(number))
        {
            throw new Error("Unexpected argument type. Argument value: " + number);
        }

        var parts = number.toString().split(".");   // Split string representation of the number to integer and decimal parts.
        return parts.length == 2 ? parts[1].length : 0;
    };

    cast.boolToInt = function(value)
    {
        /// <summary>Converts boolean value to integer number.</summary>

        return value ? 1 : 0;
    };

    cast.formatFloatLocal = function(value, decimalDigitCount)
    {
        /// <summary>Converts float to string according to local CAST settings.</summary>
        /// <param name="value" type="number">Number for conversion.</param>
        /// <param name="decimalDigitCount" type="number" optional="true">
        /// Number of digits after the decimal point. If decimalDigitCount is not supplied or undefined, function assumes the value is decimalDigitCountLocal().
        /// </param>
        /// <returns>Returns a string representing a number for local CAST settings.</returns>
        /// <remarks>This is a wrapper for 'formatFloatLocal' function in Localization.inc</remarks>

        return cast.isNumber(value) ? formatFloatLocal(value, decimalDigitCount) : null;
    };

    cast.formatIntLocal = function(value)
    {
        /// <summary>Converts int to string according to local CAST settings.</summary>
        /// <param name="value" type="number">Number for conversion.</param>
        /// <returns>Returns a string representing a number for local CAST settings.</returns>

        return cast.isInteger(value) ? cast.formatFloatLocal(value, 0) : null;
    };

    cast.formatTextboxLocal = function(textbox, dataType, decimalDigitCount)
    {
        /// <summary>Formats textbox with an integer number according to local formatting settings.</summary>

        var value = cast.unformatLocal(textbox.value, dataType, decimalDigitCount);
        if (isNaN(value))
        {
            // If textbox has invalid value.
            return;
        }

        if ((dataType == DATA_TYPE.INT && cast.isInteger(value))
            || (dataType == DATA_TYPE.FLOAT && cast.isNumber(value)))
        {
            textbox.value = cast.formatLocal(value, dataType, decimalDigitCount);
        }
    };

    cast.formatFloat = function(inputControl, decimalDigitCount)
    {
        /// <summary>Converts float value of specified control to string according to local CAST settings.</summary>
        /// <param name="inputControl" type="jQuery">jQuery input element.</param>
        /// <param name="decimalDigitCount" type="number" optional="true">
        /// Number of digits after the decimal point. If decimalDigitCount is not supplied or undefined, function assumes the value is decimalDigitCountLocal().
        /// </param>

        var floatValue = parseFloat(inputControl.val());
        var formattedValue = cast.formatFloatLocal(floatValue, decimalDigitCount);

        inputControl.val(formattedValue);
    };

    cast.unformatFloatLocal = function(value, decimalDigitCount)
    {
        /// <summary>Parses float from a string according to local CAST settings.</summary>
        /// <param name="value" type="number">String that represents a number.</param>
        /// <param name="decimalDigitCount" type="number" optional="true">
        /// Number of digits after the decimal point. If decimalDigitCount is not supplied or undefined, function assumes the value is decimalDigitCountLocal().
        /// </param>
        /// <returns>Returns a number that was read from value. If value cannot be parsed returns NaN.</returns>
        /// <remarks>This is a wrapper for 'unformatFloatLocal' function in Localization.inc</remarks>

        return unformatFloatLocal(value, decimalDigitCount);
    };

    cast.unformatIntLocal = function(value)
    {
        /// <summary>Parses int from a string according to local CAST settings.</summary>
        /// <param name="value" type="number">String that represents a number.</param>
        /// <returns>Returns a number that was read from value. If value cannot be parsed returns NaN.</returns>

        return cast.unformatFloatLocal(value, 0);
    };

    cast.formatDateLocal = function(date)
    {
        /// <summary>Converts date to string according to local CAST settings.</summary>
        /// <param name="date" type="Date">Date for conversion.</param>
        /// <returns>Returns a string representing a date for local CAST settings.</returns>
        /// <remarks>This is a wrapper for 'formatDateLocal' function in Localization.inc</remarks>

        return formatDateLocal(date);
    };

    cast.formatDateTimeLocal = function (date) {
        /// <summary>Converts date to string according to local CAST settings.</summary>
        /// <param name="date" type="Date">Date for conversion.</param>
        /// <returns>Returns a string representing a date with time for local CAST settings.</returns>
        /// <remarks>This is a wrapper for 'formatDateTimeLocal' function in Localization.inc</remarks>

        return formatDateTimeLocal(date);
    };


    cast.unformatDateLocal = function(value)
    {
        /// <summary>Parses date from a string according to local CAST settings.</summary>
        /// <param name="date" type="string">String that represents a date.</param>
        /// <returns>Returns a date that was read from value. If value cannot be parsed returns 'undefined'.</returns>
        /// <remarks>This is a wrapper for 'parseDateLocal' function in Localization.inc</remarks>

        return parseDateLocal(value);
    };

    cast.getDateFormat = function()
    {
        /// <summary>Gets date format according to local CAST settings (e.g. "mm/dd/yyyy").</summary>
        /// <remarks>This is a wrapper for 'dateFormatLocal' function in Localization.inc</remarks>

        return dateFormatLocal();
    };

    cast.formatTimeLocal = function(time, withSeconds)
    {
        /// <summary>Converts time to string according to local CAST settings.</summary>
        /// <param name="time" type="Date">Time for conversion.</param>
        /// <param name="withSeconds" type="boolean">Optional. If true then seconds will be presented in a result. Default: false.</param>
        /// <returns>Returns a string representing a time for local CAST settings.</returns>
        /// <remarks>This is a wrapper for 'formatTimeLocal' function in Localization.inc</remarks>

        return formatTimeLocal(time, withSeconds);
    };

    cast.unformatTimeLocal = function(time, withSeconds)
    {
        /// <summary>Parses time from a string according to local CAST settings.</summary>
        /// <param name="time" type="Date">String that represents a time.</param>
        /// <param name="withSeconds" type="boolean">Optional. Boolean. If true then seconds will be presented in a result. Default: false.</param>
        /// <returns>Returns a time that was read from value. If value cannot be parsed returns 'undefined'.</returns>
        /// <remarks>This is a wrapper for 'parseTimeLocal' function in Localization.inc</remarks>

        return parseTimeLocal(time, withSeconds);
    };

    cast.formatLocal = function(value, dataType, decimalDigits)
    {
        /// <summary>
        /// Converts value of specified control to string according to local CAST settings and data type.
        /// Returns null if the given value has wrong type.
        /// </summary>
        /// <param name="value" type="number">Number for conversion.</param>
        /// <param name="dataType" type="string">Value data type.</param>
        /// <param name="decimalDigitCount" type="number" optional="true">
        /// Number of digits after the decimal point. If decimalDigitCount is not supplied or undefined, function assumes the value is decimalDigitCountLocal().
        /// </param>

        switch (dataType)
        {
            case DATA_TYPE.FLOAT:
            case DATA_TYPE.DECIMAL:
                return cast.formatFloatLocal(value, decimalDigits);
            case DATA_TYPE.INT:
                return cast.formatIntLocal(value);
            default:
                throw "data type isn't supported.";
        }
    };

    cast.unformatLocal = function(value, dataType, decimalDigits)
    {
        /// <summary>Parses value from a string according to local CAST settings and data type.</summary>
        /// <param name="value" type="string">String from which number will be parsed.</param>
        /// <param name="dataType" type="string">Destination data type.</param>
        /// <param name="decimalDigitCount" type="number" optional="true">
        /// Number of digits after the decimal point. If decimalDigitCount is not supplied or undefined, function assumes the value is decimalDigitCountLocal().
        /// </param>

        switch (dataType)
        {
            case DATA_TYPE.FLOAT:
            case DATA_TYPE.DECIMAL:
                return cast.unformatFloatLocal(value, decimalDigits);
            case DATA_TYPE.INT:
                return cast.unformatIntLocal(value);
            default:
                throw "data type isn't supported.";
        }
    };

    cast.convertLocalToUTCDate = function(date)
    {
        /// <summary>Returns UTC date-time value from supplied local date-time.</summary>
        /// <remarks>This is a wrapper for 'parseTimeLocal' function in Localization.inc</remarks>

        return convertLocalToUTCDate(date);
    };

    function validateFloatLocalInternal(control, options)
    {
        /// <summary>Internal function to validate DOM element according to the given options.</summary>

        return checkUserInputFloat(
            control,
            options.isEmptyDisallowed, options.decimalDigitCount, options.errorMessage, options.minValue, options.maxValue);
    }

    cast.validateIntLocal = function(control, customOptions)
    {
        /// <summary>Validates DOM element with integer value according to the given options.</summary>

        // Override default options with custom ones.
        var options = $.extend({
            isEmptyDisallowed: true,
            errorMessage: undefined,
            minValue: 0,
            maxValue: undefined
        }, customOptions);

        // For integer numbers decimal digit count is always 0.
        options.decimalDigitCount = 0;

        return validateFloatLocalInternal(control, options);
    };

    cast.validateFloatLocal = function(control, customOptions)
    {
        /// <summary>Validates DOM element with float value according to the given options.</summary>

        // Override default options with custom ones.
        var options = $.extend({
            isEmptyDisallowed: true,
            decimalDigitCount: 2,
            errorMessage: undefined,
            minValue: 0.01,
            maxValue: 100
        }, customOptions);

        return validateFloatLocalInternal(control, options);
    };

    cast.validateNumberRange = function(value, min, max)
    {
        return cast.isNumber(value) && value >= min && value <= max;
    };

    cast.selectTextbox = function(textbox)
    {
        /// <summary>Select text and set focus to textbox.</summary>
        /// <param name="textbox" type="object" domElement="true">Text input DOM element.</param>

        if (!textbox.disabled)
        {
            textbox.focus();
            textbox.select();
        }
    };

    cast.selectElement = function(element)
    {
        /// <summary>Select content and set focus to element.</summary>
        /// <param name="element" type="jQuery">jQuery element.</param>

        var dom = element[0];

        if (!dom || dom.disabled)
        {
            return;
        }

        dom.focus();

        if (dom.select)
        {
            dom.select();
        }
    };

    cast.toggleEnabledState = function(container, isEnabled)
    {
        /// <summary>Enable or disable container and it's child controls.</summary>
        /// <param name="container" type="jQuery">jQuery object that represent DOM element.</param>
        /// <param name="isEnabled" type="boolean">Determine, whether container should be enabled or disabled.</param>

        container.toggleClass("disabled-container", !isEnabled);

        var formElements = container.find("input, select, button, textarea");
        cast.toggleDisabledAttribute(formElements, !isEnabled);
    };

    cast.htmlEncode = function(string)
    {
        /// <summary>Similar to C# Html.Encode() function.</summary>
        /// <param name="string" type="String">String to encode.</param>
        /// <returns type="String">HTML-encoded string.</returns>

        return String(string)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    };

    cast.htmlDecode = function(string)
    {
        /// <summary>Similar to C# Html.Decode() function.</summary>

        return $("<div/>").html(string).text();
    };

    cast.getElement = function(id, extendedId)
    {
        /// <summary>
        /// Gets an element with id.
        /// </summary>
        /// <param name="id" type="string">Id of the element.</param>
        /// <param name="extendedId" type="string">Extended id of the element.</param>
        /// <returns type="jQuery element">Founded jQuery element.</returns>

        if (extendedId)
        {
            id = id + "_" + extendedId;
        }

        return $(document.getElementById(id));
    };

    cast.getControls = function(selector, constructor)
    {
        /// <summary>
        /// Creates an array of elements from jQuery selector.
        /// </summary>
        /// <param name="selector" type="jQuery selector">jQuery selector of elements.</param>
        /// <param name="constructor" type="function">Constructor to create a control from jQuery element.</param>
        /// <returns type="array">Array of the created controls.</returns>

        var result = [];
        var elements = $(selector);

        for (var i = 0; i < elements.length; i++)
        {
            var control = new constructor($(elements[i]));
            result.push(control);
        }

        return result;
    };

    cast.template = function(item, itemTemplate)
    {
        /// <summary>Maps given object to the given string template.</summary>
        /// <param name="item" type="object">Javascript object.</param>
        /// <param name="itemTemplate" type="string">String template with placeholders (e.g. "hello, {name}").</param>
        /// <returns type="string">Template-based string where placeholders are replaced with values from the given object.</returns>

        return itemTemplate.replace((/\{\w+\}/g), function(match)
        {
            var key = match.substring(1, match.length - 1);

            if (key in item)
            {
                return Cast.htmlEncode(item[key]);
            }

            // Do not replace matched placeholder.
            return match;
        });
    };

    cast.templateArray = function(collection, itemTemplate, header, footer)
    {
        /// <summary>Maps each item of the given collection of objects to the given string template.</summary>
        /// <param name="collection" type="Array">An array of the Javascript objects.</param>
        /// <param name="itemTemplate" type="string">
        /// String template for each item in the given collection with placeholders (e.g. "hello, {name}").
        /// </param>
        /// <param name="header" type="string" optional="true">An optional header string.</param>
        /// <param name="footer" type="string" optional="true">An optional footer string.</param>
        /// <returns type="string">Result of the collection templating.</returns>

        var result = [];

        if (header)
        {
            result.push(header);
        }

        for (var i = 0; i < collection.length; i++)
        {
            var item = cast.template(collection[i], itemTemplate);
            result.push(item);
        }

        if (footer)
        {
            result.push(footer);
        }

        return result.join("");
    };

    cast.getHtml = function(elementId)
    {
        /// <summary>Gets inner html of the element with given id.</summary>
        /// <param name="elementId" type="string">Element id.</param>
        /// <returns type="string">Element inner html.</returns>

        return document.getElementById(elementId).innerHTML;
    };

    cast.redirect = function(url)
    {
        /// <summary>Redirects to the given url.</summary>
        /// <param name="url" type="string">Destination url.</param>

        window.location.replace(url);
    };

    cast.setHtml = function(element, html)
    {
        /// <summary>Sets html to the given jQuery element.</summary>
        /// <param name="element" type="jQuery">jQuery element.</param>
        /// <param name="html" type="String">Html string to set.</param>

        for (var i = 0; i < element.length; ++i)
        {
            cast.setHtmlNative(element[i], html);
        }
    };

    cast.setHtmlNative = function(domElement, html)
    {
        /// <summary>Sets html to the given DOM element.</summary>
        /// <param name="element" type="DOM element">DOM element.</param>
        /// <param name="html" type="String">Html string to set.</param>

        try
        {
            domElement.innerHTML = html;
        }
        catch (e)
        {
            $(domElement).html(html);
        }
    };

    cast.bindDelayChange = function (element, handler)
    {
        /// <summary>
        /// Binds the given jQuery element to the keyboard events and calls the given handler when user stops typing.
        /// Handler will be invoked only if element value was changed (leading and trailing whitespaces are not considered).
        /// Trimmed value and jquery event object will be given to the handler.
        /// </summary>
        /// <param name="element" type="jQuery">jQuery element to attach an event.</param>
        /// <param name="handler" type="Function">An event handler.</param>

        // Delay duration in milliseconds.
        var DELAY = 300;
        var DATA_KEY = "timer";

        var getElementValue = function()
        {
            return $.trim(element.val());
        };

        // Store initial value.
        element.attr(DATA_OLD_ATTR, getElementValue());

        return element.bind("keydown keyup change paste mouseup", function (eventObj)
        {
            var context = this;

            var timer = element.data(DATA_KEY);
            if (timer)
            {
                clearTimeout(timer);
            }

            timer = setTimeout(function ()
            {
                element.data(DATA_KEY, null);

                var oldValue = element.attr(DATA_OLD_ATTR);
                var newValue = getElementValue();

                if (oldValue != newValue)
                {
                    element.attr(DATA_OLD_ATTR, newValue);
                    handler.call(context, newValue, eventObj);
                }
            }, DELAY);

            element.data(DATA_KEY, timer);
        });
    };

    cast.clearTextBoxValue = function(jQueryElement)
    {
        /// <summary>
        /// Clears jquery text input "value" and "data-old" attributes.
        /// </summary>
        /// <param name="jQueryElement" type="jQuery">jQuery object with text input.</param>

        jQueryElement.prop("value", "");
        jQueryElement.prop(DATA_OLD_ATTR, "");
    };

    cast.isNullOrEmpty = function(value)
    {
        /// <summary>Determines whether the given string is null or empty.</summary>
        /// <param name="value" type="String">String value.</param>
        /// <returns type="Boolean">True if the given value is null or empty, otherwise - false.</returns>

        return value == null || value == "";
    };

    cast.setCheckboxState = function(checkbox, state)
    {
        /// <summary>Sets checkbox state: checked, unchecked or indeterminate.</summary>
        /// <param name="checkbox" type="DOM element">Checkbox DOM element.</param>
        /// <param name="state" type="Boolean|null">
        /// Checkbox checked state if parameter is boolean.
        /// If parameter is null then checkbox will be set to indeterminate state.
        /// </param>

        if (state == null)
        {
            checkbox.indeterminate = true;
        }
        else
        {
            checkbox.indeterminate = false;
            checkbox.checked = state;
        }
    };

    cast.clone = function(obj, isDeepCopy)
    {
        /// <summary>
        /// Clones the given object. By default function performs a deep copy of the given object.
        /// </summary>
        /// <param name="source" type="obj">Source object.</param>
        /// <param name="isDeepCopy" type="Boolean">Determines whether function should create deep copy of the source object.</param>
        /// <returns type="Object">Source object copy.</returns>

        if (isDeepCopy == null)
        {
            isDeepCopy = true;
        }

        return $.extend(isDeepCopy, {}, obj);
    };

    cast.merge = function(destination, source)
    {
        /// <summary>Merges source object into destination modifying it.</summary>
        /// <param name="destination" type="Object">Object to modify</param>
        /// <param name="source" type="Object">Object to merge.</param>

        return $.extend(destination, source);
    }

    cast.nextSibling = function(domElement)
    {
        /// <summary>
        /// Gets next sibling element.
        /// </summary>
        /// <param name="domElement" type="Object">DOM Element.</param>

        var nextElement = domElement;

        do
        {
            nextElement = nextElement.nextSibling;
        }
        while (nextElement && nextElement.nodeType != 1)

        return nextElement;
    };

    cast.getQueryStringParameter = function(name)
    {
        /// <summary>Gets query string parameter value by its name.</summary>

        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");

        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
        var results = regex.exec(location.search);

        return results == null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
    };

    cast.scrollTo = function(jElement)
    {
        /// <summary>Scrolls page to the given element.</summary>

        var page = $(".pagemeat-mvc:first");

        // Current element position relatively to a window.
        var elementPosition = jElement.offset().top;

        // Desired element position relatively to a window.
        // We want to show element at the middle of the page after scroll.
        var desiredElementPosition = page.offset().top + page.height() / 2;

        var delta = elementPosition - desiredElementPosition;
        page.animate({
            scrollTop: page.scrollTop() + delta
        });
    };

    cast.failedRequestHandler = function(error)
    {
        /// <summary>Common error handler for failed requests.</summary>

        if (error instanceof Cast.ServiceError)
        {
            Cast.Alert.warning(error.message);
        }
        else
        {
            Cast.Logging.logException(error);

            // Something gone wrong.
            alert(error.message);
        }
    };

})();
(function ()
{
    DECLARE("Cast", "XmlDoc", XmlDoc);

    function XmlDoc()
    {
        /// <summary>Creates new document.</summary>

        return new ActiveXObject("Microsoft.XMLDOM");
    }
})();

(function ()
{
    DECLARE("Cast", "ServiceError", ServiceError);

    function ServiceError(errorMessage, errorCode, error)
    {
        /// <summary>Represents ServiceException for failed requests.</summary>

        this.name = "ServiceError";
        this.message = errorMessage + " (" + errorCode + ")";
        this.parameters = (error && error.Parameters) || [];

        this.errorMessage = errorMessage;
        this.errorCode = errorCode;
        this.error = error;
    }
})();

(function ()
{
    DECLARE("Cast", "NetworkError", NetworkError);

    function NetworkError(url, responseText)
    {
        /// <summary>Represents network-related error (see $.ajax.fail).</summary>

        this.name = "NetworkError";
        this.message = "Unexpected error occured while processing request to the url: " + url;
        this.url = url;
        this.responseText = responseText;
    }
})();

String.prototype.format = function()
{
    ///<summary>Similar to .Net String.Format() method.</summary>
    ///<remarks>Can be used like: "...{0}...".format(parameter1)</remarks>

    var s = this;
    var i = arguments.length;

    while (i--)
    {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

String.prototype.upperCaseFirst = function()
{
    /// <summary>Uppercase first letter.</summary>

    return this.charAt(0).toUpperCase() + this.slice(1);
};

String.prototype.lowerCaseFirst = function()
{
    /// <summary>Lowercase first letter.</summary>

    return this.charAt(0).toLowerCase() + this.slice(1);
};

Date.prototype.addMinutes = function(minutes)
{
    /// <summary>Add minutes to current Date object.</summary>
    /// <param name="minutes" type="int">Number of minutes. Negative values are allowed.</param>

    this.setMinutes(this.getMinutes() + minutes);
    return this;
};

Date.prototype.addHours = function(hours)
{
    /// <summary>Add hours to current Date object.</summary>
    /// <param name="minutes" type="int">Number of hours. Negative values are allowed.</param>

    this.setHours(this.getHours() + hours);
    return this;
};

Date.UtcNow = function()
{
    /// <summary>Creates new Date object with current UTC date.</summary>

    return Cast.convertLocalToUTCDate(new Date());
};

/// An instance of the invalid date.
Date.INVALID = new Date("Invalid date");
;
(function()
{
    var namespace = Cast.getNamespace("Cast.Translation");

    var LANGUAGE = {
        EN: "EN",
        RU: "RU",
        JP: "JP",
        CN: "CN"
    };

    // Dictionary with translations:
    // - key: translation key;
    // - value: translation value.
    var translations = {};
    var currentLanguage = getLanguageFromCookies() || LANGUAGE.EN;

    namespace.add = function(key, value)
    {
        /// <summary>Adds translation.</summary>
        /// <param name="key" type="String">Translation key.</param>
        /// <param name="value" type="String">Translation value.</param>

        translations[key] = value;
    };

    namespace.setLanguage = function(newLanguage)
    {
        /// <summary>Sets language used for translations.</summary>

        currentLanguage = newLanguage;
    };

    namespace.currentLanguageIsEnglish = function () {
        return currentLanguage == LANGUAGE.EN;
    };

    namespace.get = function (translationKey, language, options)
    {
        /// <summary>Gets translation by the given key.</summary>
        /// <param name="translationKey" type="String">Translation key.</param>
        /// <param name="language" type="String" optional="true">If set used instead of global language.</param>
        /// <param name="options" type="String" optional="true">
        /// If set, provides additional options during translation. Available option keys are:
        /// - fallbackText (String) - if provided, then the text is used as fallback text, when translation key doesn't exist;
        /// </param>

        var translation;

        // If language was not specified try page-frame translations first for backward compatibility.
        if (!language)
        {
            translation = translations[translationKey];
            if (translation)
            {
                return translation;
            }
        }

        // Try global translations.
        translation = namespace.getGlobal(translationKey, language);
        if (translation)
        {
            return translation;
        }

        // Try fallback to English translation.
        if (language !== LANGUAGE.EN)
        {
            translation = namespace.getGlobal(translationKey, LANGUAGE.EN);
            if (translation)
            {
                return translation;
            }
        }

        // Try fallback to the given text.
        if (options && options.fallbackText) {
            return options.fallbackText;
        }

        throw new Error("!Error: Translation not found for key: " + translationKey);
    };

    namespace.getGlobal = function(key, language)
    {
        /// <summary>Gets default translation from CastMain.</summary>

        language = language || currentLanguage;

        if (Cast.TopWindow.Cast.AllTranslations[key])
        {
            return Cast.TopWindow.Cast.AllTranslations[key][language];
        }
        return null;
    };

    namespace.interpolate = function(text, language)
    {
        /// <summary>Interpolates {{translation key}} values in text.</summary>
        /// <param name="text" type="string">Text to interpolate.</param>
        /// <param name="language" type="bool" optional="true">If set used instead of global language.</param>
        /// <returns type="string">Interpolated text.</returns>

        return text.replace(/{{([^}]+)}}/g, function(match, key) { return namespace.get(key, language); });
    };

    namespace.importFromJSON = function(data)
    {
        /// <summary>Imports translations from JSON.</summary>
        /// <param name="data" type="object">Object with keys as translation keys and values as translations themselves.</param>

        _.extend(translations, data);
    };

    function getLanguageFromCookies()
    {
        var match = document.cookie.match(/TranslationLanguage=(\w+)/);
        return match ? match[1] : null;
    }
})();
;
(function () {
    DECLARE("Cast", "WeakMap", WeakMap);

    var uniqueId = 0;
    function WeakMap()
    {
        this._expando_key = "__WeakMap__" + (uniqueId++) + "__";
    }

    WeakMap.prototype.get = function(key)
    {
        return key[this._expando_key];
    };

    WeakMap.prototype.set = function(key, value)
    {
        key[this._expando_key] = value;
    };

    WeakMap.prototype['delete'] = WeakMap.prototype.remove = function(key)
    {
        delete key[this._expando_key];
    };

    WeakMap.prototype.has = function(key)
    {
        return this._expando_key in key;
    };
})();

(function ()
{
    DECLARE("Cast", "WeakMultiMap", WeakMultiMap);

    var uniqueId = 0;
    function WeakMultiMap()
    {
        /// <summary>Collection of key/value pairs. Where single key can have multiple values.</summary>

        this._expando_key = "__WeakMultiMap__" + (uniqueId++) + "__";
    }

    WeakMultiMap.prototype._getValues = function (key, createIfMissing)
    {
        if (!createIfMissing)
        {
            return key[this._expando_key] || [];
        }

        // Object.defineProperty or Symbols should be used, but IE7 doesn't support them.
        key[this._expando_key] = key[this._expando_key] || [];

        return key[this._expando_key];
    };

    WeakMultiMap.prototype.add = function (key, value)
    {
        /// <summary>Adds new value for specified key.</summary>

        this._getValues(key, true).push(value);
    };

    WeakMultiMap.prototype.remove = function (key, value)
    {
        /// <summary>Removes value for specified key.</summary>

        var values = this._getValues(key, true);
        var index = _.indexOf(values, value);
        if (index != -1)
        {
            values.splice(index, 1);
        }
    };

    WeakMultiMap.prototype.get = function (key)
    {
        /// <summary>Returns all values mapped to specified key.</summary>

        return this._getValues(key, false);
    };
})();
;
(function()
{
    Cast.dialogAsync = function(config)
    {
        /// <summary>Shows dialog based on jQuery.Dialog.</summary>
        /// <remarks>Depends on: Promise polyfill, underscore, jQuery.UI</remarks>
        /// <param name="config" type="object" optional="true">
        ///     Dialog's configuration. See code for details.
        /// </param>
        /// <returns type="Promise<bool>">OK - true, Cancel - false.</returns>

        var bodyWidth = $(document.body).width();
        var bodyHeight = $(document.body).height();
        var width = bodyWidth * 0.4;
        var height = bodyHeight * 0.7;
        config = _.extend({
            // Dialogs title.
            title: Cast.Translation.get("345:Warning"),

            // Dimentions for dialog.
            width: width < 600 ? bodyWidth - 40 : width,
            maxHeight: height < 400 ? bodyHeight - 40 : height,

            // Buttons to show.
            buttons: [
                // { text: "button text", value: result for Promise }
            ],

            // Message on the left of the buttons.
            buttonPaneMessage: ""
        }, config);

        // Result is initially stored in Deferred, but then converted to ES6 Promise.
        var result = $.Deferred();

        // Create new dialog on each call, it's easier than reuse.
        var jDialog = $("<div>");
        jDialog.appendTo(document.body);

        // IEBUG: max-height is unavailable because of old doctype;
        //        height is not working with jQueryUI for some reasons.
        jDialog.css({ "overflow-y": "auto", "white-space": "normal" });

        var buttons = config.buttons.map(function(button)
        {
            return {
                text: button.text,
                click: function() { $(this).dialog("close"); result.resolve(button.value); }
            };
        });

        // Initialize dialog as modal.
        jDialog.dialog(
        {
            autoOpen: false,
            title: config.title,
            width: config.width,

            modal: true,
            resizeable:false,
            closeOnEscape: false,
            draggable: false,

            buttons: buttons,

            open: function()
            {
                var jThis = $(this);
                var maxHeight = config.maxHeight;

                // IEBUG(old doctype): emulating max-height; css-exprission doesn't work for some reasons.
                jThis.css("height", jThis.height() >= maxHeight ? maxHeight : "auto");

                // IEBUG(old doctype): centering manually
                var jDialog = jThis.closest(".ui-dialog");
                jDialog.css({
                    "left": "50%",
                    "margin-left": -jDialog.width()/2,
                    "top": "50%",
                    "margin-top": -jDialog.height()/2
                });

                // Disable whole page while dialog is opened.
                $(".BUTTONS, #xmlContainer").prop("disabled", true);
            },

            close: function ()
            {
                // Enable back page after dialog is closed.
                $(".BUTTONS, #xmlContainer").prop("disabled", false);

                // Destroy whole dialog.
                jDialog.dialog("destroy").remove();
            }
        });

        // Create and element for text near buttons.
        var jButtonpane = jDialog.closest(".ui-dialog").find(".ui-dialog-buttonpane");
        var jButtonpaneMessage = $("<span>");
        jButtonpane.append(jButtonpaneMessage);

        // Set messages.
        jButtonpaneMessage.text(config.buttonPaneMessage);
        jDialog.html(config.html);

        jDialog.dialog("open");

        // Convert Deferred to ES6 Promise.
        return new Promise(function(resolve, reject)
        {
            result.then(resolve, reject);
        });
    };

    Cast.confirmAsync = function(html)
    {
        /// <summary>Shows asynchronious confirm with specified html inside.</summary>
        /// <returns type="Promise<bool>">OK - true, Cancel - false.</returns>

        var config = {
            html: html,
            title: Cast.Translation.get("345:Warning"),
            buttons: [
                { text: Cast.Translation.get("1160:OK_Button"), value: true },
                { text: Cast.Translation.get("1161:Cancel_Button"), value: false }
            ]
        };

        return Cast.dialogAsync(config);
    };

    Cast.alertAsync = function(html)
    {
        /// <summary>Shows asynchronious alert with specified html inside.</summary>
        /// <returns type="Promise<undefined>">Indicates when alert is closed.</returns>

        var config = {
            html: html,
            title: Cast.Translation.get("345:Warning"),
            buttons: [ { text: Cast.Translation.get("1160:OK_Button"), value: undefined } ]
        };

        return Cast.dialogAsync(config);
    };

})();
;
