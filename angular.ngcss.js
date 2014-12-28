/*
 ngCss v0.5 (kk)
 (c) 2014 Nick Campbell http://opensourcetaekwondo.com/ngcss
 License: MIT
 */
(function (angular, fnLocalEvaler) {
    'use strict';

    //# Setup the required "global" vars
    var oModule = angular.module('ngCss', []),
        oCache = {},
        oDefaults = {
            attrs: "",
            commented: true,
            async: true,
            prelink: false,
            script: false,
            live: false
        }
    ;


    //#
    function isObject(o) {
        return (o && o === Object(o));
    }
    function isString(s) {
        return (typeof s === 'string' || s instanceof String);
    }
    function isFunction(f) {
        return (Object.prototype.toString.call(f) == '[object Function]');
    }


    //# HTTP GET Method functionality (supporting back to IE5.5)
    //#     NOTE: Angular's internal $http functionality does not allow for synchronous calls, hence the need for this function
    function get(sUrl, bAsync, vCallback) {
        var XHRConstructor = (XMLHttpRequest || ActiveXObject),
            $xhr
        ;

        //# IE5.5+, Based on http://toddmotto.com/writing-a-standalone-ajax-xhr-javascript-micro-library/
        try {
            $xhr = new XHRConstructor('MSXML2.XMLHTTP.3.0');
        } catch (e) { }

        //# If a function was passed rather than an object, object-ize it (else we assume it's an object with at least a .fn)
        if (isFunction(vCallback)) {
            vCallback = { fn: vCallback, arg: null };
        }

        //# If we were able to collect an $xhr object
        if ($xhr) {
            //# Setup the $xhr callback
            //$xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            $xhr.onreadystatechange = function () {
                //# If the request is finished and the .responseText is ready
                if ($xhr.readyState === 4) {
                    vCallback.fn(
                        ($xhr.status === 200 || ($xhr.status === 0 && sUrl.substr(0, 7) === "file://")),
                        $xhr.responseText,
                        vCallback.arg,
                        $xhr
                    );
                }
            };

            //# GET the sUrl
            $xhr.open("GET", sUrl, bAsync);
            $xhr.send();
        }
        //# Else we were unable to collect the $xhr, so signal a failure to the vCallback.fn
        else {
            vCallback.fn(false, null, vCallback.arg, null);
        }
    } //# get


    //# Evaluation "class" to execute code within an iFrame sandbox
    //#     NOTE: Since the sandboxEvaler occures within the scope of the iFrame, we can have this code within a "use strict" block as the generated code for the iFrame is outside of this scope.
    function sandboxEvaler($scope, a_sJS, $doc) {
        //# Returns a Javascript code string that safely collects the global version of eval into the passed sTarget
        //#     NOTE: Manually compressed SCRIPT expanded below (based on http://perfectionkills.com/global-eval-what-are-the-options/#the_problem_with_geval_windowexecscript_eval):
        //#         try {
        //#             return (function (globalObject, Object) {
        //#                 return ((1, eval)('Object') === globalObject
        //#                     ? function (c) { return (1, eval)(c); }
        //#                     : (window.execScript ? function (c) { return window.execScript(c); } : undefined)
        //#                 );
        //#             })(Object, {});
        //#         } catch (e) { return undefined; }
        function globalEvalFn() {
            return "try{return(function(g,Object){return((1,eval)('Object')===g?function(c){return(1,eval)(c);}:(window.execScript?function(c){return window.execScript(c);}:null));})(Object,{});}catch(e){return null}";
        }

        
        //# Creates a sandbox via an iFrame that is temporally added to the DOM
        //#     NOTE: The `parent` is set to `null` to completely isolate the sandboxed DOM
        function createSandbox() {
            var oReturnVal,
                $dom = ($doc.body || $doc.head || $doc.getElementsByTagName("head")[0]),
                $iFrame = $doc.createElement("iframe")
            ;

            //# Configure the $iFrame, add it into the $dom and collect the $iFrame's DOM reference into our oReturnVal
            //#     NOTE: `contentWindow` rather than `frames[frames.length - 1]`, see: http://books.google.com.au/books?id=GEQlVcVf_zkC&pg=PA589&lpg=PA589&dq=contentWindow+ie5.5&source=bl&ots=iuq6xGPVtQ&sig=XKY-1_0pMNOo-BWYjHO7uRc47bE&hl=en&sa=X&ei=bZaGVILMGsro8AXxy4DQCQ&ved=0CCgQ6AEwAQ#v=onepage&q=contentWindow%20ie5.5&f=false , http://www.bennadel.com/blog/1592-getting-iframe-window-and-then-document-references-with-contentwindow.htm
            $iFrame.style.display = "none";
            $dom.appendChild($iFrame);
            oReturnVal = $iFrame.contentWindow;

            //# .write the SCRIPT out to the $iFrame (which implicitly runs the code) then remove the $iFrame from the $dom
            //#     NOTE: We very specifically do not "use strict" below to allow eval'd code to persist across calls.
            oReturnVal.document.write(
                "<script>" +
                    "window.$sandbox={" +
                        "global: function(){" + globalEvalFn() + "}()," +
                        "local: function(s){return eval(s);}" +
                    "};" +
                    "parent=null;" +
                "<\/script>"
            );
            oReturnVal.document.close();
            //$dom.removeChild($iFrame);

            //# Return the window reference to the caller
            return oReturnVal;
        } //# createSandbox


        var i,
            $sandbox = createSandbox(),
            $eval = $sandbox.$sandbox.global || $sandbox.$sandbox.local
        ;
        
        //# Import the $scope into our $sandbox and delete the .$sandbox object (since we have the $eval reference)
        //#     NOTE: This is done so only $scope/scope is exposed to the eval'd code
        $sandbox.$scope = $scope;
        $sandbox.scope = $scope;
        delete $sandbox.$sandbox;
        
        //# Traverse the passed a_sJS, .$eval'ing each entry in-turn (as order matters)
        //#     NOTE: Since the $eval'd code is outside of our own "use strict" block (as it was .write'n to the $iFrame in createSandbox), the eval'd code will remain in-scope across all evaluations (rather than isolated per-entry as is the case with "use strict"). This allows for local functions to be declaired and used, but they automaticially fall out of scope once the eval'uations are complete.
        for (i = 0; i < a_sJS.length; i++) {
            $eval(a_sJS[i]);
        }

        //# Return the $eval'er to the caller to enable caching
        return $eval;
    }
    

    //# Transforms the passed object into an inline CSS string when bSelector is falsy (e.g. `color: red;`) or into CSS entry when bSelector is truthy (e.g. `selector { color: red; }`), where object._selector is used for the selector
    oModule.filter('css', function () {
        //# Transforms the passed object into an inline CSS string (e.g. `color: red;\n`)
        //#     NOTE: This function recurses if it finds an object
        function toCss(oObj, sCrLf) {
            var sKey, vEntry,
                sReturnVal = ""
            ;

            //# Traverse the oObj
            for (sKey in oObj) {
                //# So long as this is not a ._selector
                if (sKey !== "_selector") {
                    vEntry = oObj[sKey];

                    //# Transform the sKey from camelCase to dash-case (removing the erroneous leading dash if it's there)
                    sKey = sKey.replace(/([A-Z])/g, '-$1').toLowerCase();
                    sKey = (sKey.indexOf("-") === 0 ? sKey.substr(1) : sKey);

                    //# If this vEntry is an Object, recurse toCss() the sub-oObj
                    if (isObject(vEntry)) {
                        sReturnVal += toCss(vEntry, sCrLf);
                    }
                    //# Else we assume this is a stringable-based vEntry
                    else {
                        sReturnVal += sKey + ":" + vEntry + ";" + sCrLf;
                    }
                }
            }

            return sReturnVal;        
        }
        
        
        //# Return the .filter factory to Angular
        return function (val, vSelector, bCrLf) {
            var sCrLf = (bCrLf ? "\n" : "");

            //# If the passed val is an Object
            if (isObject(val)) {
                return (vSelector ? (isString(vSelector) ? vSelector : val._selector) + " {" : "") + sCrLf +
                    toCss(val, sCrLf) + sCrLf +
                    (vSelector ? "}" : "")
                ;
            }
            else {
                return "";
            }
        };
    });


    //# ngCss factory to house public helper methods
    oModule.factory("ngCss", ["$rootScope", "$timeout", function ($rootScope, $timeout) {
        var $factory = {};

        //# Shortcut method to properly collect the .isolateScope (or $scope) for the vElement
        $factory.getScope = function (vElement, fnCallback) {
            //# If the passed vElement isString, attempt to collect the DOM reference via .getElementById
            if (isString(vElement)) {
                vElement = document.getElementById(vElement);
            }

            //# $timeout to ensure the vElement is fully configured by Angular before collecting its .isolateScope/.scope
            $timeout(function () {
                var $scope, bIsIsolate,
                    $element = angular.element(vElement)
                ;

                //# If we were able to collect the vElement
                if ($element) {
                    //# If the $element is in the oCache, attempt to collect the .modifiedScope from there
                    if (oCache[$element[0].id]) {
                        $scope = oCache[$element[0].id].scope;
                    }

                    //# If we didn't collect the $scope from the oCache
                    if (!$scope) {
                        //# Set $scope and bIsIsolate via Angular's functions, resetting $scope if necessary
                        $scope = $element.isolateScope();
                        bIsIsolate = ($scope ? true : false);
                        if (!bIsIsolate) { $scope = $element.scope(); }
                    }
                }

                //# fnCallback with the above resolved $scope and bIsIsolate (if any)
                //#     NOTE: We use all three Boolean states of bIsIsolate; "true" == isolate, "false" == non-isolate, "undefined" == unknown
                fnCallback($scope, bIsIsolate);
            });
        };

        //# Returns a new isolated $scope with the passed oObject .extend'ed in
        //$factory.asScope = function (oObject) {
        //    var $scope;

        //    //# If the passed oObject isObject
        //    if (isObject(oObject)) {
        //        //# If the oObject is already a $scope
        //        if (oObject.$root && oObject.$root.constructor && oObject.$root.$on) {
        //            $scope = oObject;
        //        }
        //        //# Else we need to create a new $scope and extend it with the passed oObject
        //        else {
        //            $scope = angular.extend($rootScope.$new(true), oObject)
        //        }
        //    }

        //    return $scope;
        //};

        //# Extends our ngCss oDefaults options with the passed oOptions
        $factory.defaults = function (oOptions) {
            oDefaults = angular.extend(oDefaults, oOptions);
            return angular.extend({}, oDefaults);
        };

        //# Shortcut method to listen for the custom .$broadcast event
        $factory.hookUpdateCss = function (fnUpdateCSS) {
            $rootScope.$on('updateCss', function () {
                fnUpdateCSS();
            });
        };

        //# Shortcut method to .$broadcast the custom event
        $factory.updateCss = function() {
            $rootScope.$broadcast('updateCss');
        };

        //#
        $factory.newId = function(sPrefix) {
            var sRandom = Math.floor(Math.random() * 1000);

            //#
            sPrefix = sPrefix || "ngCss";

            //#
            while (document.getElementById(sPrefix + sRandom)) {
                sRandom = Math.floor(Math.random() * 1000);
            }

            return sPrefix + sRandom;
        };

        return $factory;
    }]);
    

    //# Processes the referenced CSS (either inline CSS in STYLE tags or external CSS in LINK tags) for Angular {{variables}}, optionally allowing for live binding and inline script execution.
    //# 
    //#     Options provided via the ng-css attribute (e.g. `<link ng-css="{ script: false, live: false, commented: true }" ... />`):
    //#         options.async (default: true)           Specifies if the LINK tags are to be fetched asynchronously or not
    //#         options.prelink (default: false)    Specifies if the outer $scope is to be used by the directive. A 'false' value for this option results in an isolate scope for the directive and logically requires `options.script` to be enabled (else no variables will be settable).
    //#         options.script (default: false)         Specifies if <script> tags embedded within the CSS are to be executed. "local" specifies that the eval'uations will be done within an isolated closure with local scope, any other truthy value specifies that the eval'uations will be done within an isolated sandboxed enviroment with access only given to the $scope.
    //#         options.live (default: false)           Specifies if changes made within $scope are to be automatically reflected within the CSS.
    oModule.directive('ngCss', ['$interpolate', '$timeout', 'ngCss', function ($interpolate, $timeout, $ngCss) {
        var sD1 = $interpolate.startSymbol(),
            sD2 = $interpolate.endSymbol(),
            reD1 = new RegExp("/\\*" + sD1, "g"),
            reD2 = new RegExp(sD2 + "\\*/", "g")
        ;

        //# Return the Angular .directive structure
        return {
            //# .restrict the directive to attribute only (e.g.: <style ng-css>...</style> or <link ng-css ... />)
            restrict: "A",
            
            //# Define our own isolate $scope, collecting our .options from the directive's attribute
            scope: {
                options: "=ngCss"
            },

            //# Use the template hook to scoop out the CSS before Angular processes it (so we avoid issues with double processing of {{vars}})
            template: function ($element, $attrs) {
                var $clone,
                    bDataPrefix = !$element.attr("ng-css"),
                    $domE = $element[0],
                    sTag = $element.prop("tagName").toLowerCase()
                ;

                //# If the $element doesn't have an .id, assign it one
                $domE.id = $domE.id || $ngCss.newId();

                //# Determine the .tagName and process accordingly
                switch (sTag) {
                    case "style": {
                        //# Setup the oCache entry for this $element, collecting the .css from the STYLE tag
                        oCache[$domE.id] = {
                            css: $element.html() || ""
                        };

                        //# Reset the .html of the $element so we avoid issues with double processing of {{vars}}
                        $element.html("");
                        break;
                    }
                    case "link": {
                        //# LINK tags have no contents to process, so just setup its oCache entry
                        oCache[$domE.id] = {};
                        break;
                    }
                    default: {
                        //# Reuse sTag to store the style attribute
                        sTag = $attrs.style || "";

                        //# If this $element has a style attribute with delimiters in it
                        if (sTag.indexOf(sD1) > -1) {
                            //# Reuse $clone to setup our .options (ensuring it's always an object definition)
                            $clone = $attrs.ngCss || "{}";
                            if ($clone.indexOf("{") !== 0) {
                                $clone = "{ prelink: '" + $clone + "' }";
                            }

                            //# Setup the entry in oCache
                            oCache[$domE.id] = {
                                style: $attrs.style.replace(reD1, sD1).replace(reD2, sD2),
                                option: $attrs.ngCss,
                                options: $clone
                            };

                            //# Remove the style attribute from the $element so that there are no fights between $scopes
                            $element.removeAttr("style");
                        }

                        //# Always remove the ng-css attribute to avoid $isolateScope issues with any other ng-* attributes
                        //#     NOTE: This is a sneaky trick as we are removing our own $isolateScope directive before Angular has $compile'd it
                        $element.removeAttr((bDataPrefix ? "data-" : "") + "ng-css");
                    }
                }

                //# Setup the .dataPrefix for all oCache'd $element's
                (oCache[$domE.id] || {}).dataPrefix = bDataPrefix;
            },

            //# Define the link function to wire-up our functionality at data-link
            link: function($scope, $element, $attrs) {
                var vTemp,
                    $domE = $element[0],
                    reScriptTag = /<[\/]?script.*?>/gi,
                    reScript = /<script.*?>([\s\S]*?)<\/script>/gi,
                    reScriptSrc = /<script.*?src=['"](.*?)['"].*?>/i,
                    oOptions = angular.extend({}, oDefaults, $scope.options)
                ;


                //# Prelink function to enable the $scope modification hook
                function prelink() {
                    var fnCallback = function($foreignScope) {
                        //# If a $foreignScope was passed, reset our $scope, oCache it (for use in .getScope) then .link
                        //#     NOTE: It is assumed that the developer passes in an Angular $scope under $foreignScope, else stuff won't work below
                        if ($foreignScope) {
                            $scope = $foreignScope;
                            oCache[$domE.id].scope = $scope;

                            //# Ensure the $scope has been fully updated then .link
                            $timeout(link);
                        }
                        //# Else we just need to .link
                        else {
                            link();
                        }
                    };

                    //# If a truthy .prelink was provided
                    if (oOptions.prelink) {
                        //# If the developer provided a .prelink function
                        if (isFunction(oOptions.prelink)) {
                            //# Call the developer's .prelink, passing in the fnCallback (to continue .link'ing), our $scope, the (new?) $element and the original .$link
                            oOptions.prelink(fnCallback, $scope, $element, oCache[$domE.id].$link);
                        }
                        //# Else feed it into .getScope
                        else {
                            $ngCss.getScope(oOptions.prelink, function($foreignScope) {
                                //# If the .prelink wasn't found by .getScope and it isObject, .extend it then we can .link
                                if (!$foreignScope && isObject(oOptions.prelink)) {
                                    angular.extend($scope, oOptions.prelink);
                                    link();
                                }
                                //# Else we either have a $foreignScope or .prelink isn't an object, either way pass it along to our fnCallback
                                else {
                                    fnCallback($foreignScope);
                                }
                            });
                        }
                    }
                    //# Else no .prelink was provided so we just need to .link
                    else {
                        link();
                    }
                } //# prelink
                

                //# Update the $element's CSS based on our $scope
                function updateCSS() {
                    var oEntry = oCache[$domE.id];

                    //#
                    if (oEntry.css) {
                        //# $interpolate/$eval the .css replacing the modified .css back into our $element's .html
                        $element.html($scope.$eval($interpolate(oEntry.css)));
                    }
                    //#
                    else {
                        $element.attr("style", $scope.$eval($interpolate(oEntry.style)));
                    }
                } //# updateCSS


                //# Links the CSS and sets hooks based on our oOptions
                function link() {
                    var i, $src, a_sJS,
                        sCSS = oCache[$domE.id].css || "",
                        bLocalEval = ((oOptions.script + "").toLowerCase() === "local"),
                        fnCallback = function(bSuccess, sJS, iIndex /*, $xhr*/) {
                            a_sJS[iIndex] = (bSuccess ? sJS : "");
                        }
                    ;

                    //# If we have sCSS to modify, replace any comment-surrounded /*{{Variable}}*/s
                    if (sCSS) {
                        oCache[$domE.id].css = sCSS.replace(reScript, "").replace(reD1, sD1).replace(reD2, sD2);
                    }

                    //# If the caller opted to enable SCRIPT tags within the CSS and this is a bLocalEval or we have yet to collect the fnSandboxEval
                    //#     NOTE: Holding the reference to fnSandboxEval allows us to cache the code within the sandbox rather than re-running the SCRIPT evals on every call
                    if (oOptions.script && (bLocalEval || !oCache[$domE.id].evaler)) {
                        a_sJS = sCSS.match(reScript);

                        //# If there was a_sJS in the .css
                        if (a_sJS && a_sJS.length > 0) {
                            //# Traverse the extracted a_sJS from the .css
                            for (i = 0; i < a_sJS.length; i++) {
                                $src = reScriptSrc.exec(a_sJS[i] || "");

                                //# If there is an $src in the SCRIPT tag, .get the js synchronously
                                if ($src && $src[1]) {
                                    get($src[1], false, { fn: fnCallback, arg: i });
                                }
                                //# Else this is an in-line SCRIPT tag, so reScriptTag it
                                else {
                                    a_sJS[i] = a_sJS[i].replace(reScriptTag, "");
                                }
                            }
                        
                            //# Unless the caller specifically requested a "local" eval, eval the a_sJS in a sandbox
                            //#     NOTE: In either case we only expose $scope to the eval thanks to the nature of the sandboxEvaler and the isolated closure of the fnLocalEvaler
                            if (bLocalEval) {
                                fnLocalEvaler($scope, a_sJS);
                            }
                            else {
                                oCache[$domE.id].evaler = sandboxEvaler($scope, a_sJS, document);
                            }
                        }
                    }

                    //# Now that the .css and $scope has been fully linked, .updateCSS in the $element
                    updateCSS();

                    //# If we are supposed to live-bind, .$watch for any changes in the $scope (calling our .updateCSS function when they occur)
                    if (oOptions.live) {
                        $scope.$watch(updateCSS);
                    }
                    //# Else we are not .live, so setup the event listener
                    else {
                        $ngCss.hookUpdateCss(updateCSS);
                    }
                } //# link


                //####################
                //# "Procedural" code
                //####################
                //# Determine the tagName and process accordingly
                switch ($element.prop("tagName").toLowerCase()) {
                    case "link": {
                        //# .get the file contents from the CSS file based on the passed oOptions.async
                        get($domE.href, oOptions.async, function (bSuccess, sCss /*, $xhr*/) { //# $attrs.href
                            var $newE;

                            //# If the call was a bSuccess
                            if (bSuccess) {
                                //# Set the entry for the old LINK/new STYLE $element
                                oCache[$domE.id].css = sCss;
                                oCache[$domE.id].options = oOptions;
                                oCache[$domE.id].$link = $element;

                                //# Build a $newE STYLE $element, insert it .after the LINK, copy the ng-css attribute across (while resetting $element/$domE) then remove the original LINK (as it defines unprocessed CSS that will not be reprocessed)
                                //#     NOTE: We do not use .replaceWith as we need to maintain the Angular $isolateScope (if any) on our original $link (which .remove implicitly deletes)
                                //#     NOTE: We can't use .detach because despite the documentation (https://docs.angularjs.org/api/ng/function/angular.element) it doesn't seem to be present!?
                                //#     NOTE: We can copy over the ng-css attribute below to the $newE STYLE tag because it is not getting re-$compiled by Angular (so the unnecessary recursive call will not occur)
                                $newE = angular.element("<style type='text/css' id='" + ($domE.id || $ngCss.newId()) + "'>" + sCss + "</style>");
                                $newE.attr((oCache[$domE.id].dataPrefix ? "data-" : "") + "ng-css", $element.attr("ngCss"));
                                $element.after($newE);
                                $element = $newE;
                                $domE.parentNode.removeChild($domE);
                                $domE = $newE[0];

                                //# Now that the LINK $element has been replaced by a STYLE, we can .prelink
                                prelink();
                            }
                            //# Else the call failed, so throw the error
                            else {
                                throw("ngCss E1: Unable to load file: " + $attrs.href + "\nServer Response: " + sCss);
                            }
                        });
                        break;
                    }
                    case "style": {
                        //# All we need to do for a STYLE tag is set its .options and call .prelink
                        oCache[$domE.id].options = oOptions;
                        prelink();
                        break;
                    }
                    default: {
                        //# If this $element had a style attribute with {{vars}}
                        if (oCache[$domE.id]) {
                            //# $timeout to ensure that the other oCache entries are setup
                            //$timeout(function(){
                                //# Since we removed our ng-css attribute prior to $compile'ing, we need to manually import our oOptions
                                oOptions = $scope.$eval(oCache[$domE.id].options);

                                //# If we have a truthy .prelink
                                if (oOptions.prelink) {
                                    //# Use vTemp to grab the referenced .id (if any) then import the .options
                                    vTemp = oOptions.prelink.id || oOptions.prelink;
                                    if (isString(vTemp) && oCache[vTemp]) {
                                        oOptions = angular.extend({}, oCache[vTemp].options, oOptions);
                                    }

                                    //# Now that we are post $compile, we can re-add the ng-css attribute with the original .option
                                    $element.attr((oCache[$domE.id].dataPrefix ? "data-" : "") + "ng-css", oCache[$domE.id].option);

                                    //# Now that we've imported the (modified) oOptions, we can .prelink
                                    prelink();
                                }
                                //# Else .prelink is missing, so throw the error
                                else {
                                    throw("ngCss E2: `prelink` is required for non-LINK/STYLE tags.");
                                }
                            //});
                        }
                    }
                }
            } //# link: function(...
        };
    }]); //# oModule.directive('ngCss'

})(angular,
    //# Include the fnLocalEvaler functionality from here to limit scope and have persistant eval'uations
    //#     NOTE: We play games with arguments below to limit the variables in scope as narrowly as possible (even though `arguments[1]` et'al are valid and can be called)
    //#     NOTE: Since this block is outside of the "use strict" block above, the eval'd code will remain in-scope across all evaluations (rather than isolated per-entry as is the case with "use strict"). This allows for local functions to be declared and used, but they automaticially fall out of scope once all eval'uations are complete.
    function($scope /*, a_sJS*/) {
        //# Ensure both $scope and scope are in, well, scope ;)
        var scope = $scope;

        //# Traverse the passed a_sJS (accessed from the arguments pseudo-array), processing each entry in-turn (as ordering matters)
        while (arguments[1].length > 0) {
            eval(arguments[1].shift());
        }
    }
);
