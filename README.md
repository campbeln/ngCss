# ngCss - Angular-powered CSS Preprocessor / "Live"-processor
ngCss is a tiny* Angular Directive+Filters+Module that enables binding of strings and objects (including nested objects) within CSS.
* Minified+compressed script under 2,500 bytes

## Features:
* iFrame Sandboxed Javascript `eval`uation exposing only the `$scope` to the executed code; making `eval` far less evil (`local` scoping also available to access Global scope if required).
* Supports external SCRIPT references within the CSS (e.g. `<script src='`https://github.com/gka/chroma.js `'></script>`).
* CSS can be live-bound (changes in `$scope` are `$watch`'ed) or updated via the custom `$broadcast` event updateCss.
* css and cssInline Filters output Javascript/JSON `objects` as CSS to enable mixins, including the ability to nest `objects`.
* `$scope` can be initilized within the CSS itself, allowing for all CSS-related information to be co-located within the *.css or STYLE element.
* `$scope` can be isolated or imported from any Angular `$element` (via `angular.element($element).scope()`).

## Visit http://opensourcetaekwondo.com/ngcss/ for examples and documentation.
