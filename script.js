"use strict";
// 导入 7z-wasm 模块
import SevenZip from './7z/7zz.es6.js';
document.getElementById('playbut').onclick = async function() {
	this.style.display = 'none';
	document.getElementById('loading').style.display = 'block';
	const lang = navigator.language.split("-");
	const ht = document.getElementById('ht');
	// 定义文件名
	const zName = 'classes';
	let sevenZip, cache, buffer;
	try {
		// 初始化 7-Zip 实例
		sevenZip = await SevenZip({
			// 自定义日志/错误输出
			print: (str) => {
				ht.innerText = str;
				console.log('7z日志:', str);
			},
			printErr: (str) => {
				ht.innerText = str;
				console.error('7z错误:', str);
			},
			// 禁用自动退出运行时（浏览器环境必需）
			noExitRuntime: true
		});
		if (!sevenZip) {
			throw new Error('初始化失败！');
		}
		// 优先从缓存读取
		cache = await caches.open(location.hostname);
		const cachedResponse = await cache.match(zName);
		// 如果缓存存在且有效，直接使用缓存数据
		if (cachedResponse) {
			ht.innerText = '正在从缓存加载数据包';
			buffer = new Uint8Array(await cachedResponse.arrayBuffer());
		} else {
			// 缓存不存在时下载文件
			const response = await fetch('./data/' + zName + '.7z');
			// 检查响应状态
			if (!response.ok) {
				ht.innerText = '资源下载失败！';
				throw new Error(`下载失败：${response.status} ${response.statusText}`);
			}
			// Content-Length返回字符串转数字
			const datalen = Number(response.headers.get('Content-Length'));
			const zdata = response.body.getReader();
			let receivedLength = 0;
			let chunks = [];
			// 流式下载文件
			while (true) {
				const {
					done,
					value
				} = await zdata.read();
				if (done) break;
				chunks.push(value);
				receivedLength += value.length;
				ht.innerText = '正在下载资源...(' + (receivedLength / datalen * 100).toFixed(2) + '%)';
			}
			// 拼接二进制数据
			buffer = new Uint8Array(receivedLength);
			let position = 0;
			for (let chunk of chunks) {
				buffer.set(chunk, position);
				position += chunk.length;
			}
			// 下载完成后立即写入缓存
			ht.innerText = '正在写入缓存...';
			await cache.put(zName, new Response(buffer, {
				headers: {
					'Content-Type': 'application/x-7z-compressed'
				}
			}));
		}
		// 初始化7z并执行解压
		if (!buffer) throw new Error('压缩包数据为空');
		// 将二进制数据写入7z内存文件系统
		const stream = sevenZip.FS.open(zName, 'w+');
		sevenZip.FS.write(stream, buffer, 0, buffer.length);
		sevenZip.FS.close(stream);
		// 解压所有文件
		ht.innerText = '开始解压文件...';
		sevenZip.callMain(['x', zName, '-p2585649532', '-aoa', '-y']);
		// 动态创建script标签并使用Blob URL加载
		const script = document.createElement('script');
		script.defer = true;
		script.type = 'text/javascript';
		// 赋值给script的src
		const blobUrl = URL.createObjectURL(new Blob([new TextDecoder('utf-8').decode(sevenZip.FS.readFile(
			zName + '.js'))], {
			type: 'application/javascript; charset=utf-8'
		}));
		script.src = blobUrl;
		// 统一释放Blob URL的逻辑
		const revokeBlob = () => URL.revokeObjectURL(blobUrl);
		// 监听加载状态
		script.onload = () => {
			console.log(`✅ ${zName} 加载完成`);
			ht.innerText = '即将完成';
			// 脚本加载完成后立即执行main()
			main();
			// 释放Blob URL，避免内存泄漏
			revokeBlob();
		};
		script.onerror = (err) => {
			console.error(`❌ ${zName} 加载失败: ${err.message}`);
			// 失败时也需要释放Blob URL
			revokeBlob();
		};
		ht.innerText = '正在加载环境...';
		let relayId = Math.floor(Math.random() * 3);
		window.eaglercraftXOpts = {
			demoMode: false,
			container: "game_frame",
			assetsURI: "./data/assets.epk",
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
		const targetServer = new URLSearchParams(window.location.search).get("server");
		if (targetServer) window.eaglercraftXOpts.joinServer = targetServer;
		// 添加到body执行
		document.body.appendChild(script);
	} catch (err) {
		ht.innerText = '错误:' + err.message;
		throw (err);
	} finally {
		// 清理内存文件系统（避免内存泄漏）
		if (sevenZip && sevenZip.FS) {
			try {
				sevenZip.FS.unlink(zName);
			} catch (e) {
				console.error('清理7z文件失败：', e);
			}
		}
	}
}