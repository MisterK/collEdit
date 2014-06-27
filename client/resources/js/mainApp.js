'use strict';

/* App level Angular module
 * Requires: persistenceServices.js, dataServices.js, ioServices.js, directives.js, controllers.js
 */
angular.module('colledit', ['colledit.persistenceServices',
                                'colledit.dataAngularServices',
                                'colledit.ioAngularServices',
                                'colledit.d3AngularServices',
                                'colledit.directives',
                                'colledit.controllers']);