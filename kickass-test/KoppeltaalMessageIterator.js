/**
 * KoppeltaalMessageIterator.js
 * 
 * Created on 12-mrt-2015, 14:41:06
 *
 * @author Harm Boschloo for Ranj
 **/
var ranj = ranj || {};
(function (ranj) {

	var KoppeltaalMessageIterator = function (client, queryArguments) {
		this._client = client;
		this._queryArguments = queryArguments;
		this._messageHeaders = null;
		this._lastProcessedMessageId = null;
	};

	var p = KoppeltaalMessageIterator.prototype;

	p.next = function (successCallback, errorCallback) {
		this._successCallback = successCallback;
		this._errorCallback = errorCallback;
		this._next();
	};

	p.setLastProcessedMessage = function (message) {
		var messageHeaderEntry = message.entry[0];
		this._lastProcessedMessageId = Koppeltaal.MessageHeader.getMessageHeaderId(messageHeaderEntry);
	};

	p.getRemainingMessageHeaders = function () {
		return this._messageHeaders;
	};

	p.clearRemainingMessageHeaders = function () {
		this._messageHeaders = null;
	};

	p._next = function () {
		try {
			if (this._messageHeaders === null) {
				this._client.getMessageHeaders(
						this._queryArguments,
						this._onMessageHeaders.bind(this),
						this._errorCallback);
			} else if (this._messageHeaders.length === 0) {
				this._successCallback(null);
			} else {
				var messageHeader = this._messageHeaders[0];
				this._messageHeaders.splice(0, 1);
				if (messageHeader.id === this._lastProcessedMessageId) {
					console.log("Already processed message with id " + messageHeader.id);
					this._successCallback(null);
				} else {
					this._client.getMessageWithId(messageHeader.id, this._onMessage.bind(this), this._errorCallback);
				}
			}
		} catch (error) {
			this._errorCallback(error);
		}
	};

	p._onMessageHeaders = function (message) {
		this._messageHeaders = [];

		console.log("received message headers message: " + JSON.stringify(message, null, '\t'));

		if (message.entry) {
			console.log("received message headers: " + message.entry.length);
			for (var i = 0; i < message.entry.length; ++i) {
				var messageHeaderEntry = message.entry[i];
				var id = Koppeltaal.MessageHeader.getMessageHeaderId(messageHeaderEntry);

				var entryHeader = messageHeaderEntry.content;
				var processingStatus = Koppeltaal.MessageHeader.getProcessingStatus(entryHeader);
				console.log("message id: " + id + "; status: " + processingStatus);

				this._messageHeaders.push({id: id, entry: messageHeaderEntry});
			}

			this._messageHeaders.sort(KoppeltaalMessageIterator._compareFunction);

			console.log("received message headers: " + this._messageHeaders.length);
		}

		this._next();
	};

	p._onMessage = function (message) {
		console.log("received message: " + JSON.stringify(message, null, '\t'));
		this._successCallback(message);
	};

	KoppeltaalMessageIterator._compareFunction = function (a, b) {
		if (a.id > b.id) {
			return -1;
		}
		if (a.id < b.id) {
			return 1;
		}
		return 0;
	};

	// Export
	ranj.KoppeltaalMessageIterator = KoppeltaalMessageIterator;

})(ranj);