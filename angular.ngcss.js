/*
Copyright (c) 2014 Nick Campbell (ngcssdev@gmail.com)
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function (angular, fnLocalEvaler) {
    'use strict';

    //# Setup the required "global" vars
    var oModule = angular.module('ngCss', []),
        oCache = {},
        oDefaults = {
            commented: true,
            async: true,
            importScope: false,
            script: false,
            live: false
        }
    ;

    
    //# Evaluation "class" to execute code within an iFrame sandbox
    //#     NOTE: Since the $sandboxEvaler occures within the scope of the iFrame, we can have this code within a "use strict" block as the generated code for the iFrame is outside of this scope.
    function $sandboxEvaler($scope, a_sJS, $doc) {
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
            oReturnVal.document.write(
                "<script>" +
                    "window.$sandbox={" +
                        "global: function(){" + globalEvalFn() + "}()," +
                        "local: function(s){return eval(s);}" +
                    "};" +
                    "parent=null;" +
                "<\/script>"
            );
            $dom.removeChild($iFrame);

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
        //#     NOTE: Since the .$eval code is outside of our own "use strict" block (as it was .write'n to the $iFrame in createSandbox), the eval'd code will remain in-scope across all evaluations (rather than isolated per-entry as is the case with "use strict"). This allows for local functions to be declaired and used, but they automaticially fall out of scope once the eval'uations are complete.
        for (i = 0; i < a_sJS.length; i++) {
            $eval(a_sJS[i]);
        }
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
                    if (vEntry && vEntry === Object(vEntry)) {
                        sReturnVal += toCss(vEntry);
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
        return function (val, bSelector, bCrLf) {
            var sCrLf = (bCrLf ? "\n" : "");

            return (bSelector ? val._selector + " {" : "") + sCrLf +
                toCss(val, sCrLf) + sCrLf +
                (bSelector ? "}" : "")
            ;
        };
    });


    //# ngCss factory to house helper methods
    oModule.factory("ngCss", ["$rootScope", "$timeout", function ($rootScope, $timeout) {
        var $factory = {};

        //# Shortcut method to properly collect the .isolateScope (or $scope) for the vElement
        $factory.getScope = function (vElement, fnCallback) {
            //# If the passed vElement is a string, attempt to collect the DOM reference via .getElementById
            if ((typeof vElement === 'string' || vElement instanceof String)) {
                vElement = document.getElementById(vElement);
            }

            //# $timeout to ensure the vElement is fully configured by Angular before collecting its .isolateScope/.scope
            $timeout(function () {
                var $scope, bIsIsolate,
                    $element = angular.element(vElement)
                ;

                //# If the $element exists in the oCache then it replaced a $link, so reset $element to the original (now detached) $link
                if (oCache[$element]) {
                    $element = oCache[$element];
                }

                //# Set $scope and bIsIsolate, resetting $scope if necessary
                $scope = $element.isolateScope();
                bIsIsolate = ($scope ? true : false);
                if (!bIsIsolate) { $scope = $element.scope(); }

                //# fnCallback with the above resolved $scope and bIsIsolate
                fnCallback($scope, bIsIsolate);
            });
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

        return $factory;
    }]);
    

    //# Processes the referenced CSS (either inline CSS in STYLE tags or external CSS in LINK tags) for Angular {{variables}}, optionally allowing for live binding and inline script execution.
    //# 
    //#     Options provided via the ng-css attribute (e.g. `<link ng-css="{ script: false, live: false, commented: true }" ... />`):
    //#         options.commented (default: true)       Specifies if Angular variables within the CSS are surrounded by CSS comment tags. E.g. `/*{{ngVariable}}*/`.
    //#         options.async (default: true)           Specifies if the LINK tags are to be fetched asynchronously or not
    //#         options.importScope (default: false)    Specifies if the outer $scope is to be used by the directive. A 'false' value for this option results in an isolate scope for the directive and logically requires `options.script` to be enabled (else no variables will be settable).
    //#         options.script (default: false)         Specifies if <script> tags embedded within the CSS are to be executed. "local" specifies that the eval'uations will be done within an isolated closure with local scope, any other truthy value specifies that the eval'uations will be done within an isolated sandboxed enviroment with access only given to the $scope.
    //#         options.live (default: false)           Specifies if changes made within $scope are to be automatically reflected within the CSS.
    oModule.directive('ngCss', ['$interpolate', 'ngCss', function ($interpolate, $ngCss) {
        return {
            //# .restrict the directive to attribute only (e.g.: <style ng-css>...</style> or <link ng-css ... />)
            restrict: "A",
            
            //# Define our own isolate $scope, collecting our .options from the directive's attribute
            scope: {
                options: "=ngCss"
            },

            //# Define the link function to wire-up our functionality at data-link
            link: function($scope, $element, $attrs) {
                var sCss,
                    reScriptTag = /<[\/]?script.*?>/gi,
                    reScript = /<script.*?>([\s\S]*?)<\/script>/gi,
                    reScriptSrc = /<script.*?src=['"](.*?)['"].*?>/i,
                    oOptions = angular.extend({}, oDefaults, $scope.options),
                    vImportScope = (oOptions.importScope ? oOptions.importScope : false)
                ;


                //# HTTP GET Method functionality (supporting back to IE5.5)
                //#     NOTE: Angular's internal $http functionality does not allow for synchronous calls, hence the need for this function
                function get(sUrl, bAsync, fnCallback) {
                    var $xhr;

                    //# IE5.5+, Based on http://toddmotto.com/writing-a-standalone-ajax-xhr-javascript-micro-library/
                    try {
                        $xhr = new (XMLHttpRequest || ActiveXObject)('MSXML2.XMLHTTP.3.0');
                    } catch (e) { }

                    //# If we were able to collect an $xhr object
                    if ($xhr) {
                        //# Setup the callback
                        //$xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                        $xhr.onreadystatechange = function () {
                            //# If the request is finished and the .responseText is ready
                            if ($xhr.readyState === 4) {
                                fnCallback(($xhr.status === 200), $xhr.responseText);
                            }
                        };

                        //# GET the sUrl
                        $xhr.open("GET", sUrl, bAsync);
                        $xhr.send();
                    }
                    //# Else we were unable to collect the $xhr, so signal a failure to the fnCallback
                    else {
                        fnCallback(false);
                    }
                } //# get


                //# Resolves our $scope based on the oOptions.importScope 
                function resolveScope() {
                    var bImportParent = (vImportScope === true);

                    //# Callback function to import the passed $importScope (or optionally its .$parent) and .process our $element
                    function callback($importScope, bIsIsolate) {
                        $scope = (bImportParent && bIsIsolate ? $importScope.$parent : $importScope);

                        //# If the $scope wasn't successfully set in .resolveScope, throw the error
                        if (!$scope) {
                            throw ("ngCss Error #1: Unable to resolve `$scope` as specified in `oOptions.importScope`: " + oOptions.importScope);
                        }
                        else {
                            process();
                        }
                    }

                    //# If we have no $scope to import, we only need to .process our $element
                    if (vImportScope === false) {
                        process();
                    }
                    //# Else we need to overwrite our own isolate $scope with what is specified in oOptions.importScope
                    else {
                        //# If the .importScope is a function, call it passing in our own callback
                        if (Object.prototype.toString.call(vImportScope) == '[object Function]') {
                            vImportScope(callback);
                        }
                        //# Else...
                        else {
                            //# If .importScope is set to true, import our $element's .$parent $scope via our callback
                            //# Else we assume the .importScope is an $element reference of some form that is processable via angular.element(), so import our vImportScope via our callback
                            $ngCss.getScope((bImportParent ? $element : vImportScope), callback);
                        }
                    }
                } //# resolveScope


                //# Update the sCss based on our $scope
                function updateCSS() {
                    //# $interpolate/$eval the sCss replacing the modified sCss back into our $element's .html
                    $element.html($scope.$eval($interpolate(sCss)));
                } //# updateCSS


                //# Processes the CSS and sets hooks based on our oOptions
                function process() {
                    //# If the caller has opted to enable SCRIPT tags within the CSS
                    //#     TODO: Cache eval'd SCRIPT?
                    if (oOptions.script) {
                        var i, $src,
                            bSandbox = ((oOptions.script + "").toLowerCase() !== "local"),
                            a_sJS = sCss.match(reScript)
                        ;
                        
                        //# If there was a_sJS in the sCss
                        if (a_sJS && a_sJS.length > 0) {
                            //# Traverse the extracted a_sJS from the sCss
                            for (i = 0; i < a_sJS.length; i++) {
                                $src = reScriptSrc.exec(a_sJS[i] || "");

                                //# If there is an $src in the SCRIPT tag, .get the js synchronously
                                if ($src && $src[1]) {
                                    get($src[1], false, function(bSuccess, js) {
                                        a_sJS[i] = (bSuccess ? js : "");
                                    });
                                }
                                //# Else this is an in-line SCRIPT tag, so reScriptTag it
                                else {
                                    a_sJS[i] = a_sJS[i].replace(reScriptTag, "");
                                }
                            }
                        
                            //# Unless the caller specificially requested a "local" eval, eval the a_sJS in a bSandbox
                            //#     NOTE: In either case we only expose $scope to the eval thanks to the nature of the $sandboxEvaler and the isolated closure of the fnLocalEvaler
                            (bSandbox
                                ? $sandboxEvaler($scope, a_sJS, document)
                                : fnLocalEvaler($scope, a_sJS)
                            );
                        }
                    }

                    //# Unless we've explicitly been told the Angular variables are not .commented, assume they are and pre-process the sCss accordingly
                    //#     TODO: Collect the Angular delimiters from Angular itself rather than hard-coding {{}} below
                    if (oOptions.commented !== false) {
                        sCss = sCss.replace(reScript, "").replace(/\/\*{{/g, "{{").replace(/}}\*\//g, "}}");
                    }

                    //# Now that the sCss and $scope has been fully processed, .updateCSS in the $element
                    updateCSS();

                    //# If we are supposed to live-bind, .$watch for any changes in the $scope (calling our .updateCSS function when they occur)
                    if (oOptions.live) {
                        $scope.$watch(updateCSS);
                    }
                    //# Else we are not .live, so setup the event listener
                    else {
                        $ngCss.hookUpdateCss(updateCSS);
                    }
                } //# process



                //####################
                //# "Procedural" code
                //####################
                //# Determine the tagName and process accordingly
                switch ($element.prop("tagName").toLowerCase()) {
                    case "link": {
                        //# .get the file contents from the CSS file based on the set .async
                        get($attrs.href, oOptions.async, function (bSuccess, response) {
                            //# If the call was a bSuccess
                            if (bSuccess) {
                                var $link = $element,
                                    sID = $link[0].id
                                ;

                                //# Grab the sCss contents from the response and finish setting up the sID
                                sCss = response;
                                sID = (sID ? "id='" + sID + "'" : "");

                                //# Build a new STYLE $element, oCache our original $link $element then remove it from the DOM (as it defines unprocessed CSS that will not be reprocessed) then .append the new STYLE $element into the .head
                                //#     NOTE: We do not use .remove as we need to maintain the Angular $scope data on our original $link (which .remove implicitly deletes)
                                //#     NOTE: We can't use .detach because despite the documentation (https://docs.angularjs.org/api/ng/function/angular.element) it doesn't seem to be present!?
                                //#     TODO: Import other attributes?
                                $element = angular.element("<style type='text/css' " + sID + ">" + sCss + "</style>");
                                oCache[$element] = $link;
                                $link[0].parentNode.removeChild($link[0]);
                                angular.element(document.head || document.getElementsByTagName('head')[0]).append($element);

                                //# Now that the $link $element has been replaced by a STYLE, we can .resolveScope
                                resolveScope();
                            }
                            //# Else the call failed, so throw the error
                            else {
                                throw ("ngCss Error #2: Unable to load file: " + $attrs.href + "\nServer Response: " + response);
                            }
                        });
                        break;
                    }
                    case "style": {
                        //# Grab the sCss contents from the $element's .html then .resolveScope
                        sCss = ($element.html() + '');
                        resolveScope();
                        break;
                    }
                    default: {
                        //#     TODO: Enable style attribute processing?
                        throw ("ngCss Error #3: Attribute must be applied to either a LINK or STYLE tag.");
                    }
                }
            } //# link: function(...
        };
    }]); //# oModule.directive('ngCss'

})(angular,
    //# Include the fnLocalEvaler functionality to limit scope and have persistant eval'uations
    //#     NOTE: We play games with arguments below to limit the variables in scope as narrowly as possible (even though `arguments[1]` et'al are valid and can be called)
    //#     NOTE: Since this block is outside of the "use strict" block above, the eval'd code will remain in-scope across all evaluations (rather than isolated per-entry as is the case with "use strict"). This allows for local functions to be declared and used, but they automaticially fall out of scope once the eval'uations are complete.
    function($scope /*, a_sJS*/) {
        //# Ensure both $scope and scope are in, well, scope ;)
        var scope = $scope;

        //# Traverse the passed a_sJS (accessed from the arguments pseudo-array), processing each entry in-turn (as ordering matters)
        while (arguments[1].length > 0) {
            eval(arguments[1].shift());
        }
    }
);
