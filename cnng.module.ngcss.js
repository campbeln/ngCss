/*
Minified via http://www.jsmini.com/
Copyright (c) 2014 Nick Campbell (ngcssdev@gmail.com)
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function (angular) {
    'use strict';

    //# Setup the required "global" vars
    var crlf,
        module = angular.module('ngCss', [])
    ;
    
    //# 
    function isObject(x) {
        return (x && x === Object(x));
    }

    //# Transforms the passed object into an inline CSS string (e.g. `color: red;\n`)
    //#     NOTE: This function recurses if it finds an object
    function toCss(obj) {
        var key, entry,
            css = ""
        ;

        //# Traverse the obj
        for (key in obj) {
            //# So long as this is not a .$selector
            if (key !== "$selector") {
                entry = obj[key];

                //# Transform the key from camelCase to dash-case (removing the erroneous leading dash if it's there)
                key = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                key = (key.indexOf("-") === 0 ? key.substr(1) : key);

                //# If this entry .isObject, recurse toCss() the sub-obj
                if (isObject(entry)) {
                    css += toCss(entry);
                }
                //# Else we assume this is a string-based entry
                else {
                    css += key + ": " + entry + ";" + crlf;
                }
            }
        }

        return css;
    }

    //#
    module.factory("ngCss", ["$rootScope", "$timeout", function ($rootScope, $timeout) {
        var factory = {};

        //# Shortcut method to properly collect the .isolateScope (or $scope) for the $element
        factory.scope = function ($element, fnCallback) {
            //# $timeout to ensure the $element is fully configured by Angular before collecting its .isolateScope
            $timeout(function () {
                //# Set $scope and bIsIsolate, resetting $scope if necessary
                var $scope = angular.element($element).isolateScope(),
                    bIsIsolate = ($scope ? true : false)
                ;
                if (!bIsIsolate) { $scope = angular.element($element).scope(); }

                //# Pass the $scope and bIsIsolate to the fnCallback
                fnCallback($scope, bIsIsolate);
            });
        };

        //# Shortcut method to .$broadcast the custom event
        factory.updateCss = function() {
            $rootScope.$broadcast('updateCss');
        };

        return factory;
    }]);



    //# Transforms the passed object into an inline CSS string (e.g. `color: red;`)
    module.filter('cssInline', function () {
        return function (val) {
            return toCss(val);
        };
    });


    //# Transforms the passed object into CSS entry (e.g. `selector { color: red; }`), where object.$selector is used for the selector
    module.filter('css', function () {
        return function (val) {
            return val.$selector + " {\n" + toCss(val) + "}";
        };
    });


    //# Processes the referenced CSS (either inline CSS in STYLE tags or external CSS in LINK tags) for Angular {{variables}}, optionally allowing for live binding and inline script execution.
    //# 
    //#     Options provided via the ng-css attribute (e.g. `<link ng-css="{ script: false, live: false, commented: true }" ... />`):
    //#         options.script (default: false)         Specifies if <script> tags embedded within the CSS are to be executed.
    //#         options.live (default: false)           Specifies if changes made within $scope are to be automatically reflected within the CSS.
    //#         options.commented (default: true)       Specifies if Angular variables within the CSS are surrounded by CSS comment tags. E.g. `/*{{ngVariable}}*/`.
    //#         options.crlf (default: false)           Specifies if ngCss is to add `\n` after each CSS entry. Note that enabling this will throw off the line numbers of the processed code when debugging.
    //#         options.importScope (default: false)    Specifies if the outer $scope is to be used by the directive. A 'false' value for this option results in an isolate scope for the directive and logically requires `options.script` to be enabled (else no variables will be settable).
    module.directive('ngCss', ['$interpolate', '$http', '$rootScope', '$timeout', function ($interpolate, $http, $rootScope, $timeout) {
        return {
            //# .restrict the directive to attribute only (e.g.: <style ng-css>...</style> or <link ng-css ... />)
            restrict: "A",
            scope: {},
            link: function($scope, $element, $attrs) {
                var css,
                    options, //options = $scope.$eval($attrs["ngCss"]) || {},
                    importScope, //importScope = options["importScope"] || false,
                    reScript = /<script.*?>([\s\S]*?)<\/script>/gi
                ;

                //# eval the options and set importScope
                eval("options = " + $attrs["ngCss"] + ";");
                importScope = options["importScope"] || false;

                //# Update the css based on our $scope
                function updateCSS() {
                    //# Reset the crlf based on our options, then $interpolate the css, $eval'ing the result and replacing the modified css back into our $element's .html
                    crlf = (options["crlf"] === true ? "\n" : "");
                    $element.html($scope.$eval($interpolate(css)));
                }

                //# Resolves the $scope based on the options.importScope 
                function resolveScope(flag) {
                    //# Unless we've explicitly been told not to (or .importScope was undefined), overwrite our $scope with what is specified in options.importScope
                    if (importScope !== false) {
                        //# If the .importScope is set to true, import the $element's .$parent $scope (which is the surrounding non-isolate $scope)
                        if (importScope === true) {
                            $scope = angular.element($element).scope();
                            //$scope = $scope.$parent;
                        }
                        //# Else if the passed importScope is a function, call it, taking its return as our $scope
                        else if (Object.prototype.toString.call(importScope) == '[object Function]') {
                            $scope = importScope($scope);
                        }
                        //# Else if this is a flag'ed (recursive) call
                        else if (flag) {
                            //# If the .importScope .isObject assume it's an $element reference, else assume it's an $element's ID while failing over to our own $element reference or a isolate $scope if everything fails
                            $scope = angular.element(
                                (isObject(importScope) ? importScope : document.getElementById(importScope))
                            ).scope();

                            //# If the $scope wasn't successfully set above, throw the error
                            if (!$scope) {
                                throw ("ngCss Error #1: Unable to resolve `$scope` as specified in `options.importScope`.");
                            }

                            //# Unflip the flag to falsely so processCSS is run below 
                            flag = 0;
                        }
                        //# Else we've not run the $timeout yet, so do so now
                        else {
                            $timeout(function () {
                                resolveScope(1);
                            });

                            //# Flip flag to truthy so processCSS is not run below 
                            flag = 1;
                        }
                    }

                    //# If this is not a flag'ed call, processCSS
                    if (!flag) { processCSS(); }
                }

                //# Processes the CSS and sets hooks based on our options
                function processCSS() {
                    //# If the caller has specifically opted to enable SCRIPT tags within the *.css
                    if (options["script"] === true) {
                        var i,
                            js = css.match(reScript),
                            reDeScript = /<[\/]?script.*?>/gi
                        ;

                        //# Traverse the extracted js from the css (if any), reDeScript'ing as we go 
                        if (js) {
                            for (i = 0; i < js.length; i++) {
                                eval(js[i].replace(reDeScript, ""));
                            }
                        }
                    }

                    //# Unless we've explicitly been told the Angular variables are not .commented, assume they are and pre-process the css accordingly
                    if (options["commented"] !== false) {
                        css = css.replace(reScript, "").replace(/\/\*{{/g, "{{").replace(/}}\*\//g, "}}");
                    }

                    //# Now that the css and $scope has been fully processed, updateCSS in the $element
                    updateCSS();

                    //# If we are supposed to live-bind .$watch for any changes in the $scope, calling our updateCSS function when they occur
                    if (options["live"] === true) {
                        $scope.$watch(updateCSS);
                    }
                        //# Else we are not .live, so setup the event listener
                    else {
                        $rootScope.$on('updateCss', function () {
                            updateCSS();
                        });
                    }
                }


                //# Determine the tagName and process accordingly
                switch ($element.prop("tagName").toUpperCase()) {
                    case "LINK": {
                        //# .get the file contents from the *.css file
                        $http.get($attrs["href"])
                            .success(function (response) {
                                var $head = angular.element(document.getElementsByTagName('head'));

                                //# Grab the css contents from the response
                                css = response;

                                //# .remove the current LINK tag (as it defines unprocessed CSS) then build and .append a new STYLE $element
                                //#     NOTE: We include the unprocessed css in the new STYLE $element so the page is at least partially dressed by the CSS while we wait for binding
                                $element.remove();
                                $element = angular.element("<style type='text/css'>" + css + "</style>");
                                $head.append($element);

                                //# Now that the LINK $element has been replaced by a STYLE, we can init
                                resolveScope();
                            })
                            .error(function (response) {
                                throw ("ngCss Error #2: Unable to load file: " + $attrs["href"] + "\nServer Response: " + response);
                            })
                        ;
                        break;
                    }
                    case "STYLE": {
                        //# Grab the css contents from the $element's .html then init
                        css = ($element.html() + '');
                        resolveScope();
                        break;
                    }
                    default: {
                        throw ("ngCss Error #3: Attribute must be applied to either a LINK or STYLE tag.");
                    }
                }
            } //# link: function(...
        };
    }]); //# module.directive('ngCss'

})(angular);
