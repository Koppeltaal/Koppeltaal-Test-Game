/**
 * KoppeltaalMessageProcessor.js
 * 
 * Created on 12-mrt-2015, 15:45:49
 *
 * @author Harm Boschloo for Ranj
 **/
var ranj = ranj || {};
(function (ranj) {

	var KoppeltaalMessageProcessor = function (client, patient, event, processCallback) {
		this._client = client;
		this._processCallback = processCallback;
		this._successCallback = null;
		this._errorCallback = null;
		var queryArguments = {Patient: patient, event: event, processingStatus: "New", _count: 999};
		this._iterator = new ranj.KoppeltaalMessageIterator(this._client, queryArguments);
		this._onMessageSuccessBound = this._onMessageSuccess.bind(this);
	};

	var p = KoppeltaalMessageProcessor.prototype;

	p.run = function (successCallback, errorCallback) {
		this._successCallback = successCallback;
		this._errorCallback = errorCallback;
		this._iterator.next(this._onMessageSuccessBound, this._errorCallback);
	};

	p._onMessageSuccess = function (message) {
		if (!message) {
			// no new messages
			this._iterator.clearRemainingMessageHeaders();
			this._successCallback(null);
		} else {
			var result = this._processCallback(message);
			if (result) {
				// set last processed message so we don't get it again
				this._iterator.setLastProcessedMessage(message);
				// the the other messages to Success, we don't need them anymore
				var messageHeaders = this._iterator.getRemainingMessageHeaders();
				for (var i = 0; i < messageHeaders.length; ++i) {
					this._client.updateMessageStatusFromHeader(messageHeaders[i].entry, "Success");
				}
				this._iterator.clearRemainingMessageHeaders();
				this._successCallback(result);
			} else {
				this._iterator.next(this._onMessageSuccessBound, this._errorCallback);
			}
		}
	};

	// Export
	ranj.KoppeltaalMessageProcessor = KoppeltaalMessageProcessor;

})(ranj);