/**
 * KickassKoppeltaalMessageInfo.js
 * 
 * Created on 25-jun-2015
 *
 * @author Harm Boschloo for Ranj
 **/
var ranj = ranj || {};
var Koppeltaal = Koppeltaal || {};

(function (ranj) {

	var KickassKoppeltaalMessageInfo = {};

	KickassKoppeltaalMessageInfo.getCarePlanInfo = function (message) {
		var info = {
			id: null,
			reference: null,
			status: null,
			activity: {
				id: null,
				reference: null,
				status: null,
				subActivities: []
			},
			patient: {
				id: null,
				reference: null,
				name: null
			},
			practitioner: {
				id: null,
				reference: null,
				name: null
			}
		};

		var resourceEntries = Koppeltaal.Message.getContainedResourceEntriesWithType(message, 'CarePlan');

		var carePlanFound = false;

		for (var i = 0; !carePlanFound && i < resourceEntries.length; ++i) {
			var resourceEntry = resourceEntries[i];
			var resource = resourceEntry.content;
			if (resource && resource.activity) {
				for (var j = 0; !carePlanFound && j < resource.activity.length; ++j) {
					var activity = resource.activity[j];
					var activityKind = Koppeltaal.CarePlan.Activity.getActivityKind(activity);
					var activityDefinitionId = Koppeltaal.CarePlan.Activity.getActivityDefinitionId(activity);
                    if (activityKind.code === 'Game' || activityKind.code === 'ELearning') {
                    // TODO add a check for activity definition ID that mathes the proper ID &&  activityDefinitionId === 'RANJKA') {
						// care plan reference
						
						// Get the resource entry's selflink.
						var links = resourceEntry.link;
						if (links)
						{
							for (var i = 0; i < links.length; i++)
							{
								var link = links[0];
								if (link.rel == "self")
								{
									info.reference = link.href;
									break;
								}
							}
						}
						
						// care plan id
						info.id = resource.id || null;

						// care plan status
						info.status = resource.status || null;

						// activity id
						info.activity.id = activity.id || null;

						// activity reference
						var activityIdentifier = Koppeltaal.CarePlan.Activity.getActivityIdentifier(activity);
						if (activityIdentifier) {
							info.activity.reference = activityIdentifier;
						}

						// activity status
						var statusCoding = Koppeltaal.CarePlan.Activity.getStatus(activity);
						if (statusCoding) {
							info.activity.status = statusCoding.code;
						}

						// sub activities
						var subActivities = Koppeltaal.Resource.getExtensions(activity, Koppeltaal.CarePlan.Activity.SubActivityExtensionUri);
						for (var k = 0; k < subActivities.length; ++k) {
							info.activity.subActivities.push(subActivities[k].valueString);
						}

						// pradctitioner id
						var participants = Koppeltaal.CarePlan.Activity.getParticipantsWithRole(activity, 'Caregiver');
						if (participants.length > 0) {
							info.practitioner.reference = participants[0];
						}

						// patient id
						info.patient.reference = resource.patient.reference || null;

						// done
						carePlanFound = true;
					}
				}
			}
		}

		if (info.patient.reference) {
			var resource = Koppeltaal.Message.getContainedResource(message, info.patient.reference);
			if (resource && resource.name.length > 0 && resource.name[0].given && resource.name[0].given.length > 0) {
				info.patient.id = resource.id;
				info.patient.name = resource.name[0].given[0];
			}
		}

		if (!info.patient.name || info.patient.name === '') {
			info.patient.name = 'Speler';
		}

		if (info.practitioner.reference) {
			var resource = Koppeltaal.Message.getContainedResource(message, info.practitioner.reference);
			if (resource && resource.name.length > 0 && resource.name[0].given && resource.name[0].given.length > 0) {
				info.practitioner.id = resource.id || null;
				info.practitioner.name = resource.name[0].given[0];
			}
		}

		if (!info.practitioner.name || info.practitioner.name === '') {
			info.practitioner.name = 'Behandelaar';
		}

		return info;
	};

	KickassKoppeltaalMessageInfo.getCarePlanActivityStatusInfo = function (message) {
		var info = {
			id: null,
			reference: null,
			patient: {
				reference: null
			},
			activity: {
				reference: null,
				status: null,
				progress: 0,
				subActivities: []
			},
			gameState: {
				id: null,
				reference: null,
				data: null
			}
		};

		var messageHeader = Koppeltaal.Message.getMessageHeader(message);

		if (messageHeader) {
			info.patient.reference = Koppeltaal.MessageHeader.getPatient(messageHeader);
		}

		var resources = Koppeltaal.Message.getContainedResourcesWithTypeAndCode(message, "Other", "CarePlanActivityStatus");
		for (var i = 0; i < resources.length; ++i) {
			var resource = resources[i];
			var activityReference = Koppeltaal.CarePlan.Activity.Status.getActivity(resource);
			if (activityReference) {
				// status
				info.id = resource.id || null;
				info.reference = resource.id || null;

				// activity
				info.activity.reference = activityReference || null;

				// activity status
				var statusCoding = Koppeltaal.CarePlan.Activity.Status.getActivityStatus(resource);
				if (statusCoding) {
					info.activity.status = statusCoding.code;
				}

				// activity progress
				var progress = Koppeltaal.CarePlan.Activity.Status.getPercentageCompleted(resource);
				info.activity.progress = progress || 0;

				// sub activities
				var subActivities = Koppeltaal.CarePlan.Activity.Status.getSubActivities(resource);
				for (var s = 0; s < subActivities.length; ++s) {
					var subActivityId = Koppeltaal.CarePlan.Activity.Status.getSubActivityIdentifier(subActivities[s]);
					var subActivityStatus = Koppeltaal.CarePlan.Activity.Status.getSubActivityStatus(subActivities[s]);
					info.activity.subActivities.push({id: subActivityId, status: subActivityStatus.code});
				}

				// game state reference
				info.gameState.reference = Koppeltaal.CarePlan.Activity.Status.getBlackBoxStateReference(
						resource.content, Koppeltaal.KickassGameState.blackBoxStateExtensionUri);

				break;
			}
		}

		// game state
		if (info.gameState.reference) {
			var resource = Koppeltaal.Message.getContainedResource(message, info.gameState.reference);

			if (resource) {
				var gameData = Koppeltaal.KickassGameState.getGameDataString(resource);
				if (gameData) {
					info.gameState.id = resource.id;
					info.gameState.data = JSON.parse(gameData);
				}
			}
		}

		return info;
	};

	// Export
	ranj.KickassKoppeltaalMessageInfo = KickassKoppeltaalMessageInfo;

})(ranj);