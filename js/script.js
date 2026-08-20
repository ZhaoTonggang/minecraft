"use strict";
let cnstatus = 0,
	topstatus = 0;
const apiurl = ['https://serve.heheda.cn/minecraft/', 'https://serve.heheda.top/minecraft/'],
	hostname = window.location.hostname,
	gamebox = "https://gamebox.heheda." + (hostname.includes('heheda.cn') ? 'cn' : 'top'),
	butDiv = document.getElementById('butdiv'),
	textDiv = document.getElementById('textdiv'),
	playbut = document.getElementById('playbut'),
	htText = document.getElementById('ht');
document.getElementById('moregame').href = gamebox;
(async () => {
	// 开始 Service Worker
	if ('serviceWorker' in navigator) {
		// PWA安装提示 - 在SW注册前绑定事件，确保不遗漏beforeinstallprompt
		const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
			window.navigator.standalone === true,
			bar = document.getElementById('pwaBar'),
			text = document.getElementById('pwaText'),
			installBtn = document.getElementById('butOne'),
			dismissBtn = document.getElementById('butTwo');
		let pwaInstallEvent = null,
			pwaReady = false,
			pwaShown = false;
		const updateBarToInstall = () => {
				text.textContent = '推荐您将此网站安装为应用！';
				installBtn.textContent = '立刻安装';
				installBtn.onclick = () => {
					if (!pwaInstallEvent) return;
					bar.style.display = 'none';
					try {
						pwaInstallEvent.prompt();
					} catch {
						// prompt已被消费（用户之前拒绝过）
						text.textContent = '请在浏览器地址栏点击安装图标';
						installBtn.textContent = '知道了';
						installBtn.onclick = () => bar.style.display = 'none';
						bar.style.display = 'inline';
						return;
					}
					pwaInstallEvent.userChoice.then((choiceResult) => {
						if (choiceResult.outcome === 'accepted') {
							console.log('用户接受了PWA安装');
							pwaInstallEvent = null;
						} else {
							console.log('用户拒绝了PWA安装');
							bar.style.display = 'inline';
						}
					}).catch(() => {
						bar.style.display = 'inline';
					});
				};
				dismissBtn.textContent = '下次一定';
				dismissBtn.style.display = 'inline-block';
				dismissBtn.onclick = () => bar.style.display = 'none';
			},
			showBar = () => {
				if (pwaShown) return;
				pwaShown = true;
				if (pwaInstallEvent) {
					updateBarToInstall();
				} else {
					dismissBtn.style.display = 'none';
					text.textContent = '检测到您已安装此应用，推荐从桌面或主屏幕打开！';
					installBtn.textContent = ' 知 道 了 ';
					installBtn.onclick = () => bar.style.display = 'none';
				}
				bar.style.display = 'inline';
			};
		if (!isStandalone) {
			window.addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				pwaInstallEvent = e;
				if (pwaShown) {
					updateBarToInstall();
				} else if (pwaReady) {
					showBar();
				}
			});
			window.addEventListener('appinstalled', () => {
				document.getElementById('pwaBar').style.display = 'none';
			});
		}
		try {
			// 监听SW发送的消息
			navigator.serviceWorker.addEventListener('message', (event) => {
				if (!event.data) return;
				// 缓存更新完成通知
				if (event.data.type === 'CACHE_UPDATED') console.log('✨ PWA缓存已更新为版本:', event
					.data
					.version);
				// 缓存状态提示（命中/离线）
				if (event.data.type === 'CACHE_STATUS') {
					const {
						status,
						version
					} = event.data, el = document.getElementById('Status');
					if (!el) return;
					const [message, color] = status === 'HIT' ? ['使用缓存加载', '#4caf50'] : status ===
						'MISS' ? ['正在缓存资源', '#60b5ff'] : ['离线模式', '#ff9800'];
					el.style.backgroundColor = color;
					el.textContent = message;
					console.log(message + '，当前数据版本:' + version);
					el.style.display = 'block';
					setTimeout(() => el.style.display = 'none', 5000);
				}
			});
			// 新SW激活后自动刷新页面
			let isFirstInstall = true;
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (!isFirstInstall) window.location.reload();
				isFirstInstall = false;
			});
			// 版本更新提示函数
			const showUpdatePrompt = (worker) => {
				alert('🟢 检测到云端数据差异：\n🎉 有新版数据可用，程序即将自动重启！');
				try {
					worker.postMessage('SKIP_WAITING');
				} catch (err) {
					console.error('❌ 发送更新消息失败:', err);
					window.location.reload();
				}
			};
			// 注册Service Worker 并强制浏览器每次都检查sw.js的更新
			const registration = await navigator.serviceWorker.register('./sw.js', {
				updateViaCache: 'none'
			});
			console.log('✅ Service Worker 注册成功:', registration.scope);
			// 监听新版本发现
			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				console.log(' 发现新版本！');
				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed' && navigator.serviceWorker
						.controller) {
						console.log(' 新版本已准备好！');
						showUpdatePrompt(newWorker);
					}
				}, {
					once: true
				});
			});
		} catch (error) {
			console.log('❌ Service Worker 注册失败:', error);
		}
		// PWA就绪后，等待3秒再判断显示场景1或2（放在try/catch外，确保SW已存在时也能触发）
		if (!isStandalone) {
			navigator.serviceWorker.ready.then(() => {
				pwaReady = true;
				setTimeout(showBar, 3000);
			}).catch(() => {});
		}
	} else {
		console.log('❌ 当前浏览器不支持 Service Worker');
	}
	// 使用Fetch API测试URL延迟
	const testLatency = async (url) => {
		const controller = new AbortController(),
			timer = setTimeout(() => controller.abort(), 5000);
		try {
			const startTime = Date.now();
			await fetch(url, {
				method: 'HEAD', // 使用HEAD请求只获取响应头，减少数据传输
				signal: controller.signal,
				cache: 'no-store' // 禁用缓存
			});
			return Date.now() - startTime;
		} catch (err) {
			if (err.name === 'AbortError') {
				throw new Error(`请求超时！`);
			}
			throw err;
		} finally {
			clearTimeout(timer);
		}
	}
	// 使用示例
	try {
		const results = await Promise.allSettled([
			testLatency(apiurl[0]),
			testLatency(apiurl[1])
		]);
		// 分别处理每个请求的结果
		const apicn = document.getElementById('apicn'),
			apitop = document.getElementById('apitop');
		if (results[0].status === 'fulfilled') {
			cnstatus = 1;
			apicn.style.color = 'green';
			apicn.title = '线路一正常';
			console.log(`线路一延迟: ${results[0].value}ms`);
		} else {
			apicn.style.color = 'red';
			apicn.title = '线路一超时';
			console.error('线路一延迟测试失败:', results[0].reason);
		}
		if (results[1].status === 'fulfilled') {
			topstatus = 1;
			apitop.style.color = 'green';
			apitop.title = '线路二正常';
			console.log(`线路二延迟: ${results[1].value}ms`);
		} else {
			apitop.style.color = 'red';
			apitop.title = '线路二超时';
			console.error('线路二延迟测试失败:', results[1].reason);
		}
	} catch (err) {
		// 此处只会捕获代码执行中的异常，不会捕获单个请求的错误
		console.error('程序执行异常:', err);
	}
	textDiv.style.display = 'none';
	butDiv.style.display = 'inline-block';
})();
// 开始游戏
playbut.onclick = async () => {
	htText.textContent = '正在准备中...';
	butDiv.style.display = 'none';
	textDiv.style.display = 'block';
	// 封装错误处理函数
	const handleError = (err) => {
		console.error('❌ ' + err);
		htText.innerText = `错误: ${err}`;
	}
	// 封装操作成功函数
	const handleOk = (a) => {
		console.log('✅ ' + a);
		htText.innerText = a;
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
				htText.innerText = data;
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
					const serdata = () => {
							handleOk('云端数据加载失败，使用默认数据');
							return [{
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
							]
						},
						apifetch = async (a) => {
							try {
								const postapi = await fetch(a, {
									method: 'POST'
								});
								if (postapi.ok) {
									handleOk('云端数据加载成功');
									return (await postapi.json()).data;
								}
							} catch {
								return serdata();
							}
						};
					htText.innerText = '正在加载云端数据...';
					let servers;
					if (cnstatus && (hostname.includes('heheda.cn') || !topstatus)) {
						servers = await apifetch(apiurl[0]);
					} else if (topstatus) {
						servers = await apifetch(apiurl[1]);
					} else {
						servers = serdata();
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
						downloadOfflineButtonLink: gamebox,
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
					// 开启全屏
					const htmlel = document.documentElement;
					if (htmlel.requestFullscreen) {
						htmlel.requestFullscreen();
					} else if (htmlel.mozRequestFullScreen) {
						htmlel.mozRequestFullScreen();
					} else if (htmlel.webkitRequestFullscreen) {
						htmlel.webkitRequestFullscreen();
					} else if (htmlel.msRequestFullscreen) {
						htmlel.msRequestFullscreen();
					} else {
						console.warn('浏览器不支持全屏模式');
					}
				}
				script.onerror = (err) => {
					handleError(`❌ ${zName} 加载失败: ${err.message}`);
					terminateWorker();
				}
				htText.innerText = '正在准备环境...';
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