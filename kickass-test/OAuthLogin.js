/**
 * OAuthLogin.js
 * 
 * Created on 19-mrt-2015, 13:15:49
 *
 * @author Harm Boschloo for Ranj
 **/
var ranj = ranj || {};
var Koppeltaal = Koppeltaal || {};

(function (ranj) {

	var OAuthLogin = {};

	OAuthLogin.getURLParameter = function (name) {
		return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null;
	};

	OAuthLogin.getAuthorizationUrl = function (urlToRedirectTo, successCallback, errorCallback) {
		var serverFhirBase = OAuthLogin.getURLParameter('iss');	// Returns the fhir base of the server.
		if (!serverFhirBase) {
			errorCallback('no iss set');
			return;
		}
		
		var serverUrl = serverFhirBase.substring(0, serverFhirBase.indexOf('/FHIR/Koppeltaal'));	// Get the server url from the fhir base.

		// set session cookie
		document.cookie = 'ktServerUrl=' + serverUrl + ';path=/';

		var authorization = {
			type: 'anonymous'
		};

		var client = new Koppeltaal.Client(serverUrl, authorization);

		var clientId = 'KTSTESTGAME';
		var launchContextNumber = OAuthLogin.getURLParameter('launch');
		var scope = 'patient/*.read launch:' + launchContextNumber;
		var state = 'test';	// Optional. Can be used to track this request.

		client.getOAuthAuthorizeUrl(
				clientId, urlToRedirectTo, scope, state,
				successCallback, errorCallback);
	};

	// Export
	ranj.OAuthLogin = OAuthLogin;

})(ranj);

