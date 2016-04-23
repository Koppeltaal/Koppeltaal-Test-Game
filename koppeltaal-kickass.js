/**
 * koppeltaal-kickass.js
 * 
 * Created on 20-feb-2015, 15:58:28
 *
 * @author Harm Boschloo for Ranj
 **/

var Koppeltaal = Koppeltaal || {};

Koppeltaal.KickassGame = {
	baseUri: 'http://kickassgame.nl/FHIR/',
	carePlanActivityStatusBaseUri: 'http://kickassgame.nl/FHIR/CarePlanActivityStatus/',
	gameStateBaseUri: 'http://kickassgame.nl/FHIR/GameState/'
};

Koppeltaal.KickassGameState = {
	blackBoxStateExtensionUri: 'http://kickassgame.nl/FHIR/Koppeltaal/CarePlanActivityStatus#BlackBoxState',
	gameDataStringExtensionUri: 'http://kickassgame.nl/FHIR/Koppeltaal/KickassGameState#GameDataString',
	create: function (id) {
		var gameState = {
			resourceType: 'Other',
			id: id,
			extension: [],
			code: {
				coding: [
					Koppeltaal.ValueSets.OtherResourceUsage.BlackBoxState
				]
			}
		};

		return gameState;
	},
	getGameDataString: function (gameState)
	{
		return Koppeltaal.Resource.getExtensionValue(gameState, this.gameDataStringExtensionUri, 'String');
	},
	setGameDataString: function (gameState, gameDataString)
	{
		Koppeltaal.Resource.setExtensionValue(gameState, this.gameDataStringExtensionUri, gameDataString, 'String');
	}
};

