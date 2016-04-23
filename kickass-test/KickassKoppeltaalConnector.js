/**
 * KickassKoppeltaalConnector.js
 * 
 * Created on 26-feb-2015, 10:49:54
 *
 * @author Harm Boschloo for Ranj
 **/
var ranj = ranj || {};
var Koppeltaal = Koppeltaal || {};
(function (ranj) {

	var KickassKoppeltaalConnector = function (client, domain) {
		this._client = client;
		this._domain = domain;
		this._carePlanMessageProcessor = new ranj.KoppeltaalMessageProcessor(
				this._client,
				this._client.authorization.patient,
				Koppeltaal.ValueSets.Events.CreateOrUpdateCarePlan.code,
				this._processCarePlanMessage.bind(this));
		this._carePlanActivityStatusMessageProcessor = new ranj.KoppeltaalMessageProcessor(
				this._client,
				this._client.authorization.patient,
				Koppeltaal.ValueSets.Events.UpdateCarePlanActivityStatus.code,
				this._processCarePlanActivityStatusMessage.bind(this));
		this._carePlan = null;
		this._carePlanMessage = null;
		this._carePlanActivityStatus = null;
		this._carePlanActivityStatusMessage = null;
	};

	var p = KickassKoppeltaalConnector.prototype;

	p.getClient = function () {
		return this._client;
	};

	p.getCarePlan = function () {
		return this._carePlan;
	};

	p.getCarePlanMessage = function () {
		return this._carePlanMessage;
	};

	p.getCarePlanActivityStatusMessage = function () {
		return this._carePlanActivityStatusMessage;
	};

	p.reset = function () {
		this._carePlan = null;
		this._carePlanMessage = null;
		this._carePlanActivityStatus = null;
		this._carePlanActivityStatusMessage = null;
	};

	p.requestCarePlan = function (successCallback, errorCallback) {
		this._carePlanMessageProcessor.run(successCallback, errorCallback);
	};

	p._processCarePlanMessage = function (message) {
		this._carePlan = null;
		this._carePlanMessage = null;
		var info = null;
		try {
			info = ranj.KickassKoppeltaalMessageInfo.getCarePlanInfo(message);
			console.log("_processCarePlanMessage care plan " + JSON.stringify(info, null, '\t'));
			this._validateNotFalsy(info.id, "no care plan id");
			//this._validateNotFalsy(info.reference, "no care plan reference");
			this._validateNotFalsy(info.patient.reference, "no care plan patient reference");
			this._validateEquals(info.patient.reference, this._client.authorization.patient, "care plan patient does not match authorization patient");
			this._validateNotFalsy(info.activity.id, "no care plan activity id");
			this._validateNotFalsy(info.activity.reference, "no care plan activity reference");
			this._validateNotFalsy(info.activity.status, "no care plan activity status");
			this._validateNotFalsy((info.activity.status === Koppeltaal.ValueSets.CarePlanActivityStatus.Available.code
					|| info.activity.status === Koppeltaal.ValueSets.CarePlanActivityStatus.InProgress.code),
					"care plan activity status should be Available or InProgress");
			this._carePlan = info;
			this._carePlanMessage = message;
		} catch (error) {
			// TODO this should go to an error callback?
			console.error("_processCarePlanMessage invalid care plan " + JSON.stringify(info, null, '\t'));
			console.error("_processCarePlanMessage error: " + error);
		}

		return this._carePlan;
	};

	p.postCarePlanSubActivities = function (subActivities, successCallback, errorCallback) {
		var carePlan = this._carePlan;
		var carePlanMessage = this._carePlanMessage;
		var domain = this._domain;
		if (carePlan && carePlanMessage) {
			// create a new message
			var patientReference = carePlan.patient.reference;
			//var carePlanReference = carePlan.reference;
			var messageHeader = Koppeltaal.Message.getMessageHeader(carePlanMessage);
			var carePlanReference = Koppeltaal.MessageHeader.getFocalResource(messageHeader);
			
			var event = Koppeltaal.ValueSets.Events.CreateOrUpdateCarePlan;
			var message = Koppeltaal.PatientMessage.create(domain, event, patientReference);
			// set the version of the old message
			var headerEntry = Koppeltaal.Message.getMessageHeaderEntry(message);
			Koppeltaal.MessageHeader.setFocalResource(headerEntry.content, {reference: carePlanReference});
			// copy over the resources of the old message
			this._copyResources(carePlanMessage, message);
			// care plan
			var carePlanResource = Koppeltaal.Message.getContainedResource(message, carePlanReference);
			// activity
			var activity = Koppeltaal.CarePlan.getActivity(carePlanResource, carePlan.activity.id);
			// clear previous subactivities
			Koppeltaal.Resource.removeExtension(activity, Koppeltaal.CarePlan.Activity.SubActivityExtensionUri, true);
			// add new sub activities
			for (var k = 0; k < subActivities.length; ++k) {
				Koppeltaal.CarePlan.Activity.addSubActivity(activity, subActivities[k].id);
			}

			// set activity status to InProgress
			Koppeltaal.CarePlan.Activity.setStatus(activity, Koppeltaal.ValueSets.CarePlanActivityStatus.InProgress);
			// posting message
			this._postCarePlan(message, successCallback, errorCallback);
			return message;
		} else {
			errorCallback("no care plan");
			return null;
		}
	};

	p._postCarePlan = function (message, successCallback, errorCallback) {
		console.log("_postCarePlan:\n" + JSON.stringify(message, null, '\t'));
		var me = this;
		this._client.postMessageToMailbox(
				message,
				function (response) {
					me._processCarePlanResponse(response, message);
					successCallback(message);
					me = null;
					message = null;
				},
				errorCallback);
	};

	p._processCarePlanResponse = function (response, message) {
		console.log("response:\n" + JSON.stringify(response, null, '\t'));
		var focalResourceData = Koppeltaal.Message.getFocalResourceData(response);
		console.log("new care plan reference: " + focalResourceData.reference);
		this._updateFocalResource(message, focalResourceData, this._carePlan.reference);
		this._processCarePlanMessage(message);
	};

	// Care Plan Activity Status

	p.getCarePlanActivityStatus = function () {
		return this._carePlanActivityStatus;
	};

	p.requestCarePlanActivityStatus = function (successCallback, errorCallback) {
		if (this._carePlan) {
			this._carePlanActivityStatusMessageProcessor.run(successCallback, errorCallback);
		} else {
			errorCallback('no care plan');
		}
	};

	p._processCarePlanActivityStatusMessage = function (message) {
		this._carePlanActivityStatus = null;
		this._carePlanActivityStatusMessage = null;
		var info = null;
		try {
			info = ranj.KickassKoppeltaalMessageInfo.getCarePlanActivityStatusInfo(message);
			// check if the status contain all needed info
			this._validateNotFalsy(this._carePlan, "no care plan");
			this._validateNotFalsy(info.reference, "no care plan activity status reference");
			this._validateNotFalsy(info.activity.reference, "no care plan activity status activity reference");
			this._validateNotFalsy(info.gameState.reference, "no care plan activity status game state reference");
			// check if the status activity reference is the same as the care plan activity reference
			if (this._carePlan.activity.reference === info.activity.reference) {
				this._carePlanActivityStatus = info;
				this._carePlanActivityStatusMessage = message;
			} else {
				console.log('care plan activity status skipped; status activity reference does not match care plan activity reference');
			}
		} catch (error) {
			// TODO this should go to an error callback?
			console.error("_processCarePlanActivityStatusMessage invalid care plan activity status " + JSON.stringify(info, null, '\t'));
			console.error("_processCarePlanActivityStatusMessage error: " + error);
		}

		// this is null if there was any error
		return this._carePlanActivityStatus;
	};

	p.postCarePlanActivityStatusUpdate = function (subActivities, gameData, successCallback, errorCallback) {
		var domain = this._domain;
		var activityStatus = this._carePlanActivityStatus;
		var activityStatusMessage = this._carePlanActivityStatusMessage;
		var carePlan = this._carePlan;
		var carePlanMessage = this._carePlanMessage;
		// FIXME gameDataReference hard coded 
		var gameDataId = 1;
		var gameDataReference = Koppeltaal.KickassGame.gameStateBaseUri + gameDataId;
		var patientReference = null;
		var activityStatusReference = null;
		var gameDataId = 0;
		var gameDataReference = null;
		var message = null;
		if (activityStatus && activityStatusMessage) {
			// create new message from old message
			patientReference = activityStatus.patient.reference;
			activityStatusReference = activityStatus.reference;
			gameDataId = activityStatus.gameState.id;
			gameDataReference = activityStatus.gameState.reference;
			var event = Koppeltaal.ValueSets.Events.UpdateCarePlanActivityStatus;
			message = Koppeltaal.PatientMessage.create(domain, event, patientReference);
			// set the version of the old message
			var headerEntry = Koppeltaal.Message.getMessageHeaderEntry(message);
			Koppeltaal.MessageHeader.setFocalResource(headerEntry.content, {reference: activityStatusReference});
			// copy old message resources to new message
			this._copyResources(activityStatusMessage, message);
		} else if (carePlan && carePlanMessage) {
			// create new message
			patientReference = carePlan.patient.reference;
			var activityReference = carePlan.activity.reference;
			// for the given activity reference this must always generate the same status reference
			// so we hash the reference to create a unique* id which is always the same for the given reference
			// hash is a number that can be negative, so use the abs
			var activityStatusId = Math.abs(Koppeltaal.Util.hash(activityReference));
			activityStatusReference = Koppeltaal.KickassGame.carePlanActivityStatusBaseUri + activityStatusId;
			var gameDataBaseUrl = Koppeltaal.KickassGame.gameStateBaseUri;
			gameDataId = 1;
			gameDataReference = gameDataBaseUrl + gameDataId;
			var activityStatusResource = Koppeltaal.CarePlan.Activity.Status.create(activityStatusId);
			Koppeltaal.CarePlan.Activity.Status.setActivity(activityStatusResource, activityReference);
			Koppeltaal.CarePlan.Activity.Status.setBlackBoxStateReference(activityStatusResource,
					Koppeltaal.KickassGameState.blackBoxStateExtensionUri,
					gameDataReference);
			message = Koppeltaal.UpdateCarePlanActivityStatusMessage.create(domain, patientReference, activityStatusResource, activityStatusReference);
		} else {
			errorCallback("no care plan or care plan activity status");
			return null;
		}

		// set activity status to InProgress
		var activityStatusResource = Koppeltaal.Message.getContainedResource(message, activityStatusReference);
		// update sub activities
		Koppeltaal.CarePlan.Activity.Status.removeSubActivites(activityStatusResource);
		for (var i = 0; i < subActivities.length; ++i) {
			var statusCoding = Koppeltaal.ValueSets.CarePlanActivityStatus[subActivities[i].status];
			Koppeltaal.CarePlan.Activity.Status.addSubActivity(activityStatusResource, subActivities[i].id, statusCoding);
		}

		// set status and progess
		var progress = 0;
		var maxProgress = 100;
		var stepProgressCompleted = subActivities.length > 0 ? maxProgress / subActivities.length : 0;
		var stepProgressInProgress = stepProgressCompleted / 2;
		for (var i = 0; i < subActivities.length; ++i) {
			if (subActivities[i].status === Koppeltaal.ValueSets.CarePlanActivityStatus.InProgress.code) {
				progress += stepProgressInProgress;
			} else if (subActivities[i].status === Koppeltaal.ValueSets.CarePlanActivityStatus.Completed.code) {
				progress += stepProgressCompleted;
			}
		}
		progress = Math.floor(progress); // to int
		var status = null;
		if (progress >= maxProgress) {
			status = Koppeltaal.ValueSets.CarePlanActivityStatus.Completed;
		} else if (progress <= 0) {
			status = Koppeltaal.ValueSets.CarePlanActivityStatus.Available;
		} else {
			status = Koppeltaal.ValueSets.CarePlanActivityStatus.InProgress;
		}
		Koppeltaal.CarePlan.Activity.Status.setPercentageCompleted(activityStatusResource, progress);
		Koppeltaal.CarePlan.Activity.Status.setActivityStatus(activityStatusResource, status);
		// update game data
		Koppeltaal.Message.removeResourceEntry(message, gameDataReference, true);
		var gameDataResource = Koppeltaal.KickassGameState.create(gameDataId);
		Koppeltaal.Message.addResourceEntry(message, gameDataResource, gameDataReference);
		Koppeltaal.KickassGameState.setGameDataString(gameDataResource, JSON.stringify(gameData));
		this._postCarePlanActivityStatus(message, successCallback, errorCallback);
		return message;
	};

	p._postCarePlanActivityStatus = function (message, successCallback, errorCallback) {
		console.log("_postCarePlanActivityStatus:\n" + JSON.stringify(message, null, '\t'));
		var me = this;
		this._client.postMessageToMailbox(
				message,
				function (response) {
					// on succes read in the message again so we have the latest data stored
					me._processCarePlanActivityStatusResponse(response, message);
					successCallback(message);
					me = null;
					message = null;
				},
				errorCallback);
	};

	p._processCarePlanActivityStatusResponse = function (response, message) {
		console.log("response:\n" + JSON.stringify(response, null, '\t'));
		var focalResourceData = Koppeltaal.Message.getFocalResourceData(response);
		console.log("new care plan activity status reference: " + focalResourceData.reference);
		if (!this._carePlanActivityStatus) {
			this._carePlanActivityStatus = ranj.KickassKoppeltaalMessageInfo.getCarePlanActivityStatusInfo(message);
		}
		var oldReference = this._carePlanActivityStatus.reference;
		this._updateFocalResource(message, focalResourceData, oldReference);
		this._processCarePlanActivityStatusMessage(message);
	};

	// Care Plan & Care Plan Activity Status

	/**
	 * Async method to load a care plan and a care plan activity status. First loads a care plan. 
	 * If one is found an activity status is loaded. 
	 * Care plan and activity status are passed to the successCallback (result.carePlan and result.carePlanActivityStatus).
	 * The activity status may be null if none exists.
	 * @param {type} successCallback
	 * @param {type} errorCallback
	 * @returns {undefined}
	 */
	p.requestCarePlanAndCarePlanActivityStatus = function (successCallback, errorCallback) {
		// clear current care plan and activity status
		this.reset();

		// handle activity status success; activity status may be null
		var carePlanActivityStatusSuccessCallback = function (carePlanActivityStatus) {
			if (this._carePlan) {
				successCallback({carePlan: this._carePlan, carePlanActivityStatus: this._carePlanActivityStatus});
			} else {
				errorCallback(new Error('no care plan'));
			}
		}.bind(this);

		// handle care plan success; care plan can not be null!
		var carePlanSuccessCallback = function (carePlan) {
			if (this._carePlan) {
				this.requestCarePlanActivityStatus(carePlanActivityStatusSuccessCallback, errorCallback);
			} else {
				errorCallback(new Error('no care plan'));
			}
		}.bind(this);

		this.requestCarePlan(carePlanSuccessCallback, errorCallback);
	};

	/**
	 * Posts sub activities and game data. If the sub activities (ids) are different from the sub activities in the care plan, 
	 * the care plan will be updated. Otherwise, only the care plan activity status will be updated with the sub activities and game data.
	 * @param {type} subActivities
	 * @param {type} gameData
	 * @param {type} successCallback
	 * @param {type} errorCallback
	 * @returns {undefined}
	 */
	p.postUpdate = function (subActivities, gameData, successCallback, errorCallback) {
		if (!this._carePlan) {
			errorCallback(new Error('no care plan'));
			return;
		}

		var postCarePlan = !this.equalsCarePlanSubActivities(subActivities);

		if (postCarePlan) {
			var postCarePlanSuccessCallback = function (message) {
				this._postCarePlanActivityStatusUpdate(subActivities, gameData, message, successCallback, errorCallback);
			}.bind(this);

			this.postCarePlanSubActivities(
					subActivities,
					postCarePlanSuccessCallback,
					errorCallback);
		} else {
			this._postCarePlanActivityStatusUpdate(subActivities, gameData, null, successCallback, errorCallback);
		}
	};

	p._postCarePlanActivityStatusUpdate = function (subActivities, gameData, carePlanMessage, successCallback, errorCallback) {
		this.postCarePlanActivityStatusUpdate(
				subActivities,
				gameData,
				function (message) {
					successCallback({carePlan: carePlanMessage, carePlanActivityStatus: message});
				},
				errorCallback);
	};

	p.equalsCarePlanSubActivities = function (subActivities) {
		var carePlanSubActivities = this._carePlan ? this._carePlan.activity.subActivities : [];

		if (carePlanSubActivities.length !== subActivities.length) {
			return false;
		}

		for (var i = 0; i < subActivities.length; ++i) {
			if (carePlanSubActivities[i].id !== subActivities[i].id) {
				return false;
			}
		}

		return true;
	};

	// Utils

	p._copyResources = function (sourceMessage, destinationMessage) {
		if (sourceMessage && sourceMessage.entry && destinationMessage && destinationMessage.entry) {
			for (var i = 1; i < sourceMessage.entry.length; ++i) {
				destinationMessage.entry.push(sourceMessage.entry[i]);
			}
		}
	};
	p._updateFocalResource = function (message, focalResourceData, oldReference) {
		var header = Koppeltaal.Message.getMessageHeader(message);
		Koppeltaal.MessageHeader.setFocalResource(header, focalResourceData);
		var newReference = focalResourceData.reference;
		var resources = Koppeltaal.Message.getResources(message);
		console.log('_updateFocalResource');
		resources.forEach(function (resource) {
			console.log('resource.id: ' + resource.id);
			if (resource.id === oldReference) {
				resource.id = newReference;
				console.log('>> ' + newReference);
			}
		});
	};
	p._validateNotFalsy = function (object, error) {
		if (!object) {
			throw error;
		}
	};
	p._validateEquals = function (object, test, error) {
		if (object !== test) {
			throw error;
		}
	};
	// Export
	ranj.KickassKoppeltaalConnector = KickassKoppeltaalConnector;
})(ranj);