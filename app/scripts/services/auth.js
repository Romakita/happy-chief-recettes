'use strict';

angular.module('auth', [])

    .constant('$authEvents', {
        loginSuccess:       'auth-login-success',
        loginFailed:        'auth-login-failed',
        logoutSuccess:      'auth-logout-success',
        sessionTimeout:     'auth-session-timeout',
        notAuthenticated:   'auth-not-authenticated',
        notAuthorized:      'auth-not-authorized'
    })

    .config(function($httpProvider) {

        $httpProvider.interceptors.push([
            '$injector',
            function ($injector) {
                return $injector.get('$authInterceptor');
            }
        ]);

    })

    .run(function($rootScope, $injector, $auth, $authSession, $authEvents){

        if($authSession.exists()){//restore les données utilisateurs
            $rootScope.account =   $authSession.getUser();
        }

        $rootScope.$on('$routeChangeStart', function (event, current, previous) {

            if (current.$$route.$auth) {

                if(angular.isFunction(current.$$route.$auth) || angular.isArray(current.$$route.$auth)){

                    if($injector.invoke(current.$$route.$auth)){
                        if(!$authSession.exists()){
                            $rootScope.$broadcast($authEvents.notAuthenticated);
                        }
                    }

                }else{
                    if(current.$$route.$auth) {
                        if(!$authSession.exists()){
                            $rootScope.$broadcast($authEvents.notAuthenticated);
                        }
                    }
                }

            }
        });


    })

    .factory('$authInterceptor', function ($rootScope, $q, $authEvents, $authSession) {
        return {

            request: function (config) {
                config.headers = config.headers || {};

                if ($authSession.exists()) {

                    config.headers.Authorization = 'Bearer ' + $authSession.getToken();
                }
                return config;
            },

            responseError: function (response) {
                if (response.status === 401) {
                    $rootScope.$broadcast($authEvents.notAuthenticated, response);
                }

                if (response.status === 403) {
                    $rootScope.$broadcast($authEvents.notAuthorized, response);
                }

                if (response.status === 419 || response.status === 440) {
                    $rootScope.$broadcast($authEvents.sessionTimeout, response);
                }

                return $q.reject(response);
            }
        };
    })

    .factory('$authSession', function () {

        return {
            /**
             * tore
             * @param o
             */
            store:function(o){
                if(o.token){
                    this.setToken(o.token);
                }

                if(o.user){
                    this.setUser(o.user);
                }
            },
            /**
             *
             * @param token
             * @returns {*}
             */
            setToken:function(token){
                amplify.store.sessionStorage('token', token);
                return this;
            },
            /**
             *
             * @returns {*}
             */
            getToken:function(){
                return amplify.store.sessionStorage('token');
            },
            /**
             *
             * @param user
             * @returns {*}
             */
            setUser:function(user){
                amplify.store.sessionStorage('user', user);
                return this;
            },
            /**
             *
             * @returns {*}
             */
            getUser:function(){
                return  amplify.store.sessionStorage('user');
            },
            /**
             *
             * @returns {*}
             */
            destroy:function(){
                return this.setUser(false).setToken(false);
            },
            /**
             *
             * @returns {*}
             */
            exists:function(){
                return this.getUser() && this.getToken();
            }
        };

    })

    .provider('$auth', function authService($rootScope, $http, $authSession, $authEvents) {

        var options = {
            route: {
                success: '/',
                fail: '/login',
                disconnect: '/login'
            },

            request:{
                login:'/login',
                logout:'/logout',
                signup:'/signup'
            }
        };

        this.whenSuccess = function(route){
            options.route.success = route;
            return this;
        };

        this.whenFail = function(route){
            options.route.fail = route;
            return this;
        };

        this.whenDisconnect = function(route){
            options.route.disconnect = route;
            return this;
        };

        this.requestLogin = function(route){
            options.request.login = route;
            return this;
        };

        this.requestLogout = function(route){
            options.request.login = route;
            return this;
        };

        this.requestSignup = function(route){
            options.request.signup = route;
            return this;
        };

        this.$get = function($rootScope, $http, $authSession, $authEvents){

            $rootScope.$on($authEvents.loginSuccess, function(event, args) {
                $rootScope.account = $authSession.getUser();
                $location.path(options.route.success);
            });

            $rootScope.$on($authEvents.logoutSuccess, function(event, args) {
                $authSession.account = null;

                if(options.route.disconnect){
                    $location.path(options.route.disconnect);
                }
            });

            $rootScope.$on($authEvents.loginFailed, function(event, args) {
                $rootScope.account = null;

                if(options.route.fail) {
                    $location.path(options.route.fail);
                }
            });

            $rootScope.$on($authEvents.sessionTimeout, function(event, args) {
                $rootScope.account = null;

                if(options.route.disconnect){
                    $location.path(options.route.disconnect);
                }
            });

            return {
                store:function(o){
                    $authSession.store(o);

                    if($authSession.exists()){
                        $rootScope.$broadcast($authEvents.loginSuccess);
                    }
                },
                /**
                 *
                 * @param credentials
                 * @returns {*}
                 */
                login: function (credentials) {
                    var self = this;
                    return $http
                        .post(options.request.login, credentials)
                        .success(function (data) {
                            self.store(data);
                        })
                        .error(function () {
                            $authSession.destroy();
                            $rootScope.$broadcast($authEvents.loginFailed);
                        });
                },
                /**
                 *
                 * @param credentials
                 * @returns {*}
                 */
                signup: function (credentials) {
                    var self = this;

                    return $http
                        .post(options.request.signup, credentials)
                        .success(function (data) {
                            self.store(data);
                        })
                        .error(function () {
                            $authSession.destroy();
                            $rootScope.$broadcast($authEvents.loginFailed);
                        });
                },
                /**
                 *
                 * @returns {*}
                 */
                logout:function(){

                    $rootScope.$broadcast($authEvents.logoutSuccess);

                    return $http
                        .post(options.request.logout)
                        .success(function () {
                            $authSession.destroy();
                        })
                        .error(function () {
                            $authSession.destroy();
                        });
                }
            };
        };
    });


