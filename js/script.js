"use strict";
document.getElementById('playbut').onclick = async (e) => {
	e.target.style.display = 'none';
	document.getElementById('loading').style.display = 'block';
	const lang = navigator.language.split("-");
	const ht = document.getElementById('ht');
	// 封装错误处理函数（统一更新UI+打印日志）
	const handleError = (err) => {
		console.error(err);
		ht.innerText = `错误: ${err}`;
	}
	// 封装Worker终止逻辑
	const terminateWorker = () => {
		if (worker) {
			worker.terminate();
		}
	}
	// 定义文件名
	const zName = 'data';
	const worker = new Worker('./js/worker.js');
	// 监听Worker消息
	worker.onmessage = (msg) => {
		const {
			type,
			data,
			error
		} = msg.data;
		switch (type) {
			case 'status':
				ht.innerText = data;
				break;
			case 'error':
				handleError(`Worker返回错误: ${error}`);
				break;
			case 'complete':
				if (!data.js || !data.epk) throw new Error('数据为空！');
				// 动态创建script标签并使用Blob URL加载
				const script = document.createElement('script');
				script.defer = true;
				script.type = 'text/javascript';
				// 赋值给script的src
				const blobUrl = data.js;
				script.src = blobUrl;
				// 统一释放Blob URL的逻辑
				const revokeBlob = () => {
					if (blobUrl) URL.revokeObjectURL(blobUrl);
				}
				// 监听加载状态
				script.onload = () => {
					const text = `✅ ${zName} 加载完成`;
					console.log(text);
					ht.innerText = text;
					// 脚本加载完成后立即执行main()
					main();
					// 释放Blob URL，避免内存泄漏
					revokeBlob(); // 释放Blob URL
					// terminateWorker(); // 终止Worker，释放资源
				};
				script.onerror = (err) => {
					// 失败时也需要释放Blob URL
					revokeBlob();
					handleError(`❌ ${zName} 加载失败: ${err.message}`);
					terminateWorker();
				}
				ht.innerText = '正在准备环境...';
				let relayId = Math.floor(Math.random() * 3);
				window.eaglercraftXOpts = {
					demoMode: false,
					container: "game_frame",
					assetsURI: data.epk,
					localesURI: "./lang/",
					lang: lang[0] + "_" + lang[1],
					worldsDB: "worlds",
					resourcePacksDB: "resource",
					enableDownloadOfflineButton: true,
					downloadOfflineButtonLink: "https://gamebox.heheda.top",
					forceWebGL2: true,
					html5CursorSupport: true,
					servers: [{
							addr: "wss://mc.arch.lol/",
							name: "ArchMC"
						},
						{
							addr: "wss://clever-teaching.com/",
							name: "Clever Teaching"
						},
						{
							addr: "wss://mc.ricenetwork.xyz/",
							name: "Rice Network"
						},
						{
							addr: "wss://cbnet.lol/",
							name: "Cheeseburger Network"
						}
					],
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
				// 处理URL参数
				const targetServer = new URLSearchParams(window.location.search).get(
					"server");
				if (targetServer) window.eaglercraftXOpts.joinServer = targetServer;
				// 添加到body执行
				document.body.appendChild(script);
				break;
		}
	}
	// 监听Worker错误
	worker.onerror = (err) => {
		handleError(`Worker错误: ${err.message} (行${err.lineno})`);
		terminateWorker();
	}
	// 监听Worker消息错误
	worker.onmessageerror = (err) => {
		handleError(`Worker消息错误: ${err.message}`);
		terminateWorker();
	}
	window.addEventListener("beforeunload", (event) => {
		event.preventDefault();
		terminateWorker();
	});
}