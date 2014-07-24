'use strict';

/* App level Angular module
 * Requires: persistenceServices.js, dataServices.js, ioServices.js, logServices.js, directives.js, controllers.js
 */
angular.module('colledit', ['colledit.persistenceServices',
                                'colledit.dataAngularServices',
                                'colledit.ioAngularServices',
                                'colledit.d3AngularServices',
                                'colledit.logServices',
                                'colledit.directives',
                                'colledit.controllers']);