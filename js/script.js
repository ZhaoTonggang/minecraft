"use strict";
document.getElementById('playbut').onclick = async (e) => {
	e.target.style.display = 'none';
	document.getElementById('loading').style.display = 'block';
	const ht = document.getElementById('ht');
	// 封装错误处理函数
	const handleError = (err) => {
		console.error('❌ ' + err);
		ht.innerText = `错误: ${err}`;
	}
	// 封装错误处理函数
	const handleOk = (a) => {
		console.log('✅ ' + a);
		ht.innerText = a;
	}
	// 封装Worker终止逻辑
	const terminateWorker = () => {
		if (worker) {
			worker.terminate();
			console.log('✅ worker 关闭成功')
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
				if (!data.jsArrayBuffer || !data.epkArrayBuffer) throw new Error('❌ 数据为空！');
				// 动态创建script标签并使用Blob URL加载
				const script = document.createElement('script');
				script.defer = true;
				script.type = 'text/javascript';
				script.src = URL.createObjectURL(new Blob([data.jsArrayBuffer], {
					type: 'application/javascript; charset=utf-8'
				}));
				// 监听加载状态
				script.onload = async () => {
					handleOk(`${zName} 加载完成`);
					// 联机服务器
					let servers;
					ht.innerText = '正在加载云端数据...';
					try {
						servers = await fetch('https://server.heheda.top/minecraft/', {
							method: 'POST'
						});
						if (servers.ok) {
							servers = (await servers.json()).data;
							handleOk('云端数据加载成功');
						}
					} catch {
						servers = [{
								"name": "Voidsent MC",
								"addr": "wss://mc.voidsent.net"
							},
							{
								"name": "VanillaMC",
								"addr": "wss://vanillamc.org"
							},
							{
								"name": "TuffNET",
								"addr": "wss://tuff.ws"
							},
							{
								"name": "Dumbshit Survival X | 1.12.2 | Vanilla Survival",
								"addr": "wss://mc.dssx.uk"
							},
							{
								"name": "Lifesteal & Creative & Anarchy",
								"addr": "wss://play.heartsmp.net"
							},
							{
								"name": "Fyre Network (BACK ONLINE!!)",
								"addr": "wss://eagler.imcalledfyre.com"
							},
							{
								"name": "null's World",
								"addr": "wss://mc.nullsworld.net"
							},
							{
								"name": "MercuryMC",
								"addr": "wss://mercurymc.net"
							},
							{
								"name": "xenaMC",
								"addr": "wss://xenamc.com"
							},
							{
								"name": "SkeletonMC",
								"addr": "wss://eagler.skeletonmc.com"
							}
						];
						handleOk('云端数据加载失败，使用本地数据');
					}
					// 配置游戏参数
					const relayId = Math.floor(Math.random() * 3);
					window.eaglercraftXOpts = {
						demoMode: false,
						container: "game_frame",
						assetsURI: URL.createObjectURL(new Blob([data.epkArrayBuffer], {
							type: 'application/octet-stream'
						})),
						localesURI: "./lang/",
						lang: navigator.language.replace('-', '_'),
						worldsDB: "worlds",
						resourcePacksDB: "resource",
						enableDownloadOfflineButton: true,
						downloadOfflineButtonLink: "https://gamebox.heheda." + (
							/^(.*\.)?heheda\.cn$/.test(window.location.hostname) ? 'cn' :
							'top'
						),
						forceWebGL2: true,
						html5CursorSupport: true,
						servers: servers,
						relays: [{
								addr: "wss://relay.deev.is/",
								comment: "lax1dude relay #1",
								primary: relayId === 0
							},
							{
								addr: "wss://relay.lax1dude.net/",
								comment: "lax1dude relay #2",
								primary: relayId === 1
							},
							{
								addr: "wss://relay.shhnowisnottheti.me/",
								comment: "ayunami relay #1",
								primary: relayId === 2
							}
						]
					}
					// 处理URL参数
					const targetServer = new URLSearchParams(window.location.search).get(
						"server");
					if (targetServer) window.eaglercraftXOpts.joinServer = targetServer;
					// 脚本加载完成后立即执行main()
					main();
					terminateWorker();
				}
				script.onerror = (err) => {
					handleError(`❌ ${zName} 加载失败: ${err.message}`);
					terminateWorker();
				}
				ht.innerText = '正在准备环境...';
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
	// 页面关闭时终止worker
	window.addEventListener("beforeunload", (event) => {
		event.preventDefault();
		terminateWorker();
	});
}