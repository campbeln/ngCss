/*
Copyright (c) 2014 Nick Campbell (ngcssdev@gmail.com)
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Add in a library such as Chroma (https://github.com/gka/chroma.js) to get color functionality present in LESS and Sass.
*/
(function ($win, $doc, fnEvalFactory) {
    "use strict";

    var cjsss = "cjsss",
        oDefaults = {
            $selector: "[" + cjsss + "], [data-" + cjsss + "]",     //# STRING (CSS selector); Selector used when autorun is enabled.
            expose: false,                                          //# BOOLEAN; Set window.cjsss?
            async: true,                                            //# BOOLEAN; Process LINK tags asynchronously?
            scope: "sandbox",                                       //# STRING (enum: global, local, sandbox); Javascript scope to evaluate code within.
            crlf: "",                                               //# STRING; Character(s) to append to the end of each line of .css/.mixin-processed CSS.
            d1: "/*{{", d2: "}}*/"                                  //# STRING; Delimiters denoting embedded Javascript variables (d1=start, d2=end).
        },
        $services = {},
        $head = ($doc.head || $doc.getElementsByTagName("head")[0])
    ;


    //# DOM querying functionality
    //#     NOTE: Include cjsss-polyfill.js to support IE7 and below
    //#     NOTE: This can also be replaced with calls to jQuery, Sizzle, etc. for sub-IE8 support, see: http://quirksmode.org/dom/core/ , http://stackoverflow.com/questions/20362260/queryselectorall-polyfill-for-all-dom-nodes
    $services.dom = function (sSelector) {
        return $doc.querySelectorAll(sSelector);
    };


    //# Exposes our functionality under the $win(dow)
    $services.expose = function () {
        $win[cjsss] = $win[cjsss] || {};
        $win[cjsss].process = $services.process;
        $win[cjsss].services = $services;
        $win[cjsss].options = oDefaults;
    }; //# $services.expose


    //# Extends the passed oTarget with the additionally provided objects
    //#     NOTE: Right-most object wins
    $services.extend = function (oTarget) {
        var i, sKey;

        //# Traverse the n passed arguments, appending/replacing the values from each into the oTarget
        //#     NOTE: i = 1 as we are skipping oTarget
        for (i = 1; i < arguments.length; i++) {
            if ($services.is.obj(arguments[i])) {
                for (sKey in arguments[i]) {
                    oTarget[sKey] = arguments[i][sKey];
                }
            }
        }
    }; //# $services.extend


    //# Wrapper for a GET AJAX call
    $services.get = function (sUrl, fnCallback, oArgument, bAsync) {
        var $xhr;
                                
        //# IE5.5+, Based on http://toddmotto.com/writing-a-standalone-ajax-xhr-javascript-micro-library/
        try {
            $xhr = new(XMLHttpRequest || ActiveXObject)('MSXML2.XMLHTTP.3.0');
        } catch (e) {}
        
        //# If we were able to collect an $xhr object
        if ($xhr) {
            //# Setup the callback
            //$xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            $xhr.onreadystatechange = function () {
                if ($xhr.readyState === 4 && $xhr.status === 200) {
                    fnCallback($xhr.responseText, oArgument);
                }
            };

            //# GET the sUrl as a sync call (hence false)
            $xhr.open("GET", sUrl, (bAsync ? true : false));
            $xhr.send();
        }
    };


    //# Datatype checking functionality
    $services.is = {
        str: function(s) {
            return (typeof s === 'string' || s instanceof String);
        },
        obj: function(o) {
            return (o && o === Object(o));
        },
        fn: function (f) {
            return (Object.prototype.toString.call(f) === '[object Function]');
        },
        arr: function(a) {
            return Object.prototype.toString.call(a) === '[object Array]';
        }
    };


    //# Parses the passed sCss using the provided oOptions
    $services.parseCss = function (sCss, oOptions) {
        var reScript = /<script.*?>([\s\S]*?)<\/script>/gi,
            reDeScript = /<[\/]?script.*?>/gi,
            reScriptSrc = /<script.*?src=['"](.*?)['"].*?>/i
        ;

        //# Form a closure around the logic to ensure the variables are not garbage collected during async calls
        //#     NOTE: I have no idea why this was occurring and this closure may not be necessary (a_sJS was being set to null). Seemed to be due to parallel calls squashing each others local vars(?!).
        return (function () {
            var a_sToken, $src, $scope, sJS, sReturnVal, i,
                a_sJS = sCss.match(reScript) || [],
                a_sTokenized = sCss.replace(reScript, "").split(oOptions.d1),
                fnMixin = function mixin(oObj, bSelector) {
                    return (bSelector ? oObj.$selector + " {" : "") +
                        $services.toCss(oObj, oOptions.crlf) +
                        (bSelector ? "}" : "")
                    ;
                }
            ;

            //# Prepend the mixin function onto the front of the a_sJS (so it is always available within the CSS SCRIPT blocks)
            //a_sJS.unshift('function mixin(oObj, bSelector) {' +
            //        'return (bSelector ? oObj.$selector + " {" : "") +' +
            //            '$services.toCss(oObj, "' + oOptions.crlf + '") +' +
            //            '(bSelector ? "}" : "")' +
            //        ';' +
            //    '}'
            //);

            //# Determine the .scope and process accordingly
            switch ((oOptions.scope + "").substr(0, 1).toLowerCase()) {
                //# If we are to have a global .scope, set the $scope to our $win
                case "g": {
                    $scope = $win;
                    $scope.mixin = fnMixin;
                    break;
                }
                //# If we are to have a local .scope, set $scope to null
                case "l": {
                    $scope = null;
                    break;
                }
                //# If we are to have a context .scope, set $scope to the oContext
                //#     NOTE: Since we currently have no way to send in a oContext, this option is commented out
                //case "c": {
                //    $scope = {};
                //    break;
                //}
                //# Else we are to have a sandbox .scope, set $scope to a newly created sandbox
                //case "s": {
                default: {
                    $scope = $services.evalFactory.createSandbox();
                    $scope.mixin = fnMixin;
                }
            }

            var evaler = $services.evalFactory.create($scope);

            //# Traverse the extracted a_sJS from the css (if any), reDeScript'ing as we go 
            for (i = 0; i < a_sJS.length; i++) {
                $src = reScriptSrc.exec(a_sJS[i] || "");
                
                //# If there is an $src in the SCRIPT tag, .get it and .eval the resulting js synchronously (as order of SCRIPTs matters) 
                if ($src && $src[1]) {
                    $services.get($src[1], function (js) {
                        console.log("there");
                        a_sJS[i] = js;
                    }, null, false);
                }
                //# Else this is an inline SCRIPT tag, so process accordingly
                else {
                    a_sJS[i] = a_sJS[i].replace(reDeScript, "");
                }
            }

            //# Set the first index of a_sTokenized into our sReturnVal then traverse the rest of the a_sTokenized css
            //#     NOTE: Since we are splitting on .d(elimiter)1, the first index of a_sTokenized represents the STYLE before the first /*{{var}}*/ so we don't process it and simply set it as the start of our sReturnVal
            for (i = 1; i < a_sTokenized.length; i++) {
                //# .split the token off the front of the string, then if it's not a multi-line token .eval (else ignore it)
                a_sToken = a_sTokenized[i].split(oOptions.d2, 2);
                sJS = a_sToken[0];

                //# 
                a_sTokenized[i] = (sJS.indexOf("\n") === -1
                    ? { i: a_sJS.push(sJS) - 1, s: a_sToken[1] }
                    : oOptions.d1 + a_sTokenized[i]
                );
            }

            //# 
            a_sJS = evaler(a_sJS);

            //# 
            sReturnVal = a_sTokenized[0];
            for (i = 1; i < a_sTokenized.length; i++) {
                sReturnVal += ($services.is.obj(a_sTokenized[i])
                    ? a_sJS[a_sTokenized[i].i] + a_sTokenized[i].s
                    : a_sTokenized[i]
                );
            }

            //# Set the first index of a_sTokenized into our sReturnVal then traverse the rest of the a_sTokenized css
            //#     NOTE: Since we are splitting on .d(elimiter)1, the first index of a_sTokenized represents the STYLE before the first /*{{var}}*/ so we don't process it and simply set it as the start of our sReturnVal
            //sReturnVal = a_sTokenized[0];
            //for (i = 1; i < a_sTokenized.length; i++) {
            //    //# .split the token off the front of the string, then if it's not a multi-line token .eval (else ignore it)
            //    a_sToken = a_sTokenized[i].split(oOptions.d2, 2);
            //    sJS = a_sToken[0];
            //    sReturnVal += (sJS.indexOf("\n") === -1
            //        ? evaler(sJS) + a_sToken[1]
            //        : oOptions.d1 + a_sTokenized[i]
            //    );
            //}

            return sReturnVal;
        })();
    }; //# $services.parseCss


    //# Safely parses the passed sOptions into an object
    //#     NOTE: Include cjsss-polyfill.js to support IE7 and below, see: http://caniuse.com/#feat=json
    $services.parseOptions = function (sOptions) {
        return ($services.is.str(sOptions) && sOptions !== "" ? JSON.parse(sOptions) : undefined);

        //# Alt Sub-IE8 support:
        //var oReturnVal;
        //if ($services.is.str(sOptions) && sOptions !== "") {
        //    $services.evalFactory.createSandbox().$eval("oReturnVal = " + sOptions);
        //}
        //return oReturnVal;
    };


    //# Transforms the passed object into an inline CSS string (e.g. `color: red;\n`)
    //#     NOTE: This function recurses if it finds an object
    $services.toCss = function (oObj, sCrLf) {
        var sKey, entry,
            sReturnVal = ""
        ;

        //# Traverse the oObj
        for (sKey in oObj) {
            //# So long as this is not a .$selector
            if (sKey !== "$selector") {
                entry = oObj[sKey];

                //# Transform the sKey from camelCase to dash-case (removing the erroneous leading dash if it's there)
                sKey = sKey.replace(/([A-Z])/g, '-$1').toLowerCase();
                sKey = (sKey.indexOf("-") === 0 ? sKey.substr(1) : sKey);

                //# If this entry is.obj(ect), recurse toCss() the sub-obj
                if ($services.is.obj(entry)) {
                    sReturnVal += $services.toCss(entry);
                }
                    //# Else we assume this is a string-based entry
                else {
                    sReturnVal += sKey + ":" + entry + ";" + sCrLf;
                }
            }
        }

        return sReturnVal;
    }; //# $services.toCss


    //# Safely warns the user on the console
    $services.warn = function (s) {
        var c = console;
        (c ? (c.warn || c.log) : function () { })(cjsss + ": " + s);
    }; //# $services.warn


    //# Processes the CSS within the passed $elements using the provided oOptions
    $services.process = function($elements, oOptions) {
        var i, o, $current;

        //# Ensure the passed $elements is an array-like object
        $elements = ("length" in $elements ? $elements : [$elements]);

        //# Traverse the passed $elements
        for (i = 0; i < $elements.length; i++) {
            //# Reset the values for this loop
            $current = $elements[i];
            o = {};
            $services.extend(o, oOptions, $services.parseOptions($current.getAttribute(cjsss)));

            //# Determine the .tagName and process accordingly
            //#     NOTE: We utilize .data below so that we can re-process the CSS if requested, else we loose the original value when we reset innerHTML
            switch ($current.tagName.toLowerCase()) {
            case "style": {
                //# Modify the $current style tag
                $current.data = $current.data || {};
                $current.data[cjsss] = $current.data[cjsss] || $current.innerHTML;
                $current.innerHTML = $services.parseCss($current.data[cjsss], o);
                break;
            }
            case "link": {
                //# Collect the css from the LINK's href'erenced file
                $services.get($current.href, function(css, $link) {
                    //# Setup the new $style element
                    var $style = $doc.createElement('style');
                    $style.data = {};
                    $style.data[cjsss] = css;
                    $style.setAttribute("type", "text/css");
                    $style.setAttribute(cjsss, $link.getAttribute(cjsss) || "");
                    $style.innerHTML = $services.parseCss(css, o);

                    //# Remove the $link then append the new $style element under our $head
                    $link.parentNode.removeChild($link);
                    $head.appendChild($style);
                }, $current, o.async);
            }
            }
        } //# for()
    }; //# $services.process()


    //# Auto-execute our main() function
    (function main() {
        var sOptions,
            bAutoRun = true,
            $script = $services.dom("SCRIPT[src*='/" + cjsss + ".']")[0]
        ;

        //# Build the passed fnEvalFactory, setting it into our $services
        //#     NOTE: This is specifically placed outside of the "use strict" block to allow for the local eval calls below to persist across eval'uations
        $services.evalFactory = fnEvalFactory($win, $doc, $services);

        //# If we found our $script tag, reset the values of sOptions and bAutoRun
        if ($script) {
            sOptions = $script.getAttribute(cjsss) || $script.getAttribute("data-" + cjsss);
            bAutoRun = !(/\?.*?autorun=false/i.test($script.getAttribute("src")));
        }
        //# Else we could not locate our $script tag, so .warn the caller
        else {
            $services.warn("Unable to locate script tag; the filename should contain '" + cjsss + "'. Any autorun and in-line options have not been processed.");
        }

        //# If we are supposed to, .process with the .extend'ed .$selector/oDefaults
        if (bAutoRun) {
            $services.extend(oDefaults, $services.parseOptions(sOptions));
            $services.process($services.dom(oDefaults.$selector), oDefaults);
        }
        //# Else we are not supposed to bAutoRun, so ensure .expose is true (else how else will our code be run) and optionally .warn the caller
        else {
            oDefaults.expose = true;
            if (sOptions) {
                $services.warn("Autorun disabled; in-line options '" + sOptions + "' were not processed.");
            }
        }

        //# If we have been told to .expose ourselves, so do now
        if (oDefaults.expose === true) {
            $services.expose();
        }
    })();
})(
    window,
    document,
    function($win, $doc, $services) {
        var fnGEval = null;

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
            //sWin = (sWin ? sWin : "window");
            return "try{return(function(g,Object){return((1,eval)('Object')===g?function(c){return(1,eval)(c);}:(window.execScript?function(c){return window.execScript(c);}:null));})(Object,{});}catch(e){return null}";
        }

        //# 
        //function evalInContext(js, context) {
        //    //# Return the results of the in-line anonymous function we .call with the passed context
        //    return function () { return eval(js); }.call(context);
        //}

        //# Creates a sandbox via an iFrame that is temporally added to the DOM
        //#     NOTE: The `parent` is set to `null` to completely isolate the sandboxed DOM
        function createSandbox() {
            var oReturnVal,
                $dom = ($doc.body || $doc.head || $doc.getElementsByTagName("head")[0]),
                $iFrame = $doc.createElement("iframe")
            ;

            //# Configure the $iFrame, add it into the $dom and collect the $iFrame's DOM reference into our oReturnVal
            $iFrame.style.display = "none";
            $dom.appendChild($iFrame);
            oReturnVal = ($iFrame.contentWindow || $iFrame.contentDocument); //# frames[frames.length - 1];

            //# .write the SCRIPT out to the $iFrame (which implicitly runs the code) then remove the $iFrame from the $dom
            oReturnVal.document.write(
                "<script>" +
                    "window.$eval = function(){" + globalEvalFn() + "}();" +
                    "window.$sandbox=true;" +
                    "parent=null;" +
                "<\/script>"
            );
            $dom.removeChild($iFrame);

            return oReturnVal;
        } //# createSandbox


        //# Orchestrates the eval based on the passed oContext, allowing for Global (window), Sandboxed Global (sandbox), Local (null) and Context-based (non-null) versions of eval to be called
        function factory(oContext, fnFallback) {
            //# Ensure the passed fnFallback is a function
            fnFallback = ($services.is.fn(fnFallback) ? fnFallback : function (s) {
                $services.warn("Unable to collect requested `eval`, defaulting to local `eval`.");
                return eval(s);
            });

            //# Return the eval'ing function to the caller
            return function (js) {
                var i,
                    a_sReturnVal = [],
                    bReturnArray = $services.is.arr(js),
                    mixin = function (oObj, bSelector) {
                        return (bSelector ? oObj.$selector + " {" : "") +
                            $services.toCss(oObj, "") +
                            (bSelector ? "}" : "")
                        ;
                    }
                ;

                //# If the passed js wasn't an array, we need to place it into one
                if (! bReturnArray) {
                    js = [js];
                }

                //# If this is a global context call
                if (oContext === $win) {
                    //# If the global version of eval hasn't been collected yet, get it now
                    if (fnGEval === null) {
                        fnGEval = new Function(globalEvalFn())();
                        //eval("fnGEval = function(){" + globalEvalFn("$win") + "}");
                    }

                    //# Traverse the js array, eval'ing each entry as we go (placing the result into the corresponding index within our a_sReturnVal)
                    for (i = 0; i < js.length; i++) {
                        a_sReturnVal.push(fnGEval ? fnGEval(js[i]) : fnFallback(js[i]));
                    }
                }
                //# Else if this is a local context call (as no oContext was passed in), make a direct non-"use strict" call to eval
                else if (oContext === undefined || oContext === null) {
                    //# Traverse the js array, eval'ing each entry as we go (placing the result into the corresponding index within our a_sReturnVal)
                    for (i = 0; i < js.length; i++) {
                        a_sReturnVal.push(eval(js[i]));
                    }
                }
                //# Else if this is a sandbox call
                else if (oContext.parent === null && oContext.$sandbox === true) {
                    //# Traverse the js array, eval'ing each entry as we go (placing the result into the corresponding index within our a_sReturnVal)
                    for (i = 0; i < js.length; i++) {
                        a_sReturnVal.push(oContext.$eval ? oContext.$eval(js[i]) : fnFallback(js[i]));
                    }
                }
                //# Else the caller passed in a vanilla oContext, so call eval using it
                else {
                    //# Traverse the js array, eval'ing each entry as we go (placing the result into the corresponding index within our a_sReturnVal)
                    for (i = 0; i < js.length; i++) {
                        a_sReturnVal.push(function () { return eval(js[i]); }.call(oContext));
                    }
                }

                return (bReturnArray ? a_sReturnVal : a_sReturnVal[0]);
            };
        } //# factory

        //# 
        //# a function defined by a Function constructor does not inherit any scope other than the global scope (which all functions inherit)
        function evaler() {
            
        }


        //# Create the factory to return to the caller
        return {
            create: factory,
            sandbox: function (js, fnFallback) {
                return factory(createSandbox(), fnFallback)(js);
            },
            createSandbox: createSandbox //# createSandbox(oImport)
        };
    }
);
