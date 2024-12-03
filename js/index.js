"use strict";
window.addEventListener("load", function() {
	if (window.location.href.indexOf("file:") === 0) {
		alert("HTTP please, do not open this file locally, run a local HTTP server and load it via HTTP");
	} else {
		var relayId = Math.floor(Math.random() * 3);
		window.eaglercraftXOpts = {
			demoMode: false,
			container: "game_frame",
			assetsURI: "./assets.epk",
			localesURI: "./lang/",
			lang: "zh_CN",
			worldsDB: "worlds",
			resourcePacksDB: "resource",
			enableDownloadOfflineButton: true,
			servers: [{
				addr: "wss://mc.arch.lol/",
				name: "ArchMC"
			}, {
				addr: "wss://clever-teaching.com/",
				name: "Clever Teaching"
			}, {
				addr: "wss://mc.ricenetwork.xyz/",
				name: "Rice Network"
			}, {
				addr: "wss://cbnet.lol/",
				name: "Cheeseburger Network"
			}],
			relays: [{
					addr: "wss://relay.deev.is/",
					comment: "lax1dude relay #1",
					primary: relayId == 0
				},
				{
					addr: "wss://relay.lax1dude.net/",
					comment: "lax1dude relay #2",
					primary: relayId == 1
				},
				{
					addr: "wss://relay.shhnowisnottheti.me/",
					comment: "ayunami relay #1",
					primary: relayId == 2
				}
			]
		};
		var q = window.location.search;
		if ((typeof q === "string") && q[0] === "?" && (typeof window.URLSearchParams !== "undefined")) {
			q = new window.URLSearchParams(q);
			var s = q.get("server");
			if (s) window.eaglercraftXOpts.joinServer = s;
		}
		main();
	}
});